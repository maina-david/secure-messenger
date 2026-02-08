import { BaseRepository } from './BaseRepository';

export interface Chat {
  id: number;
  title: string;
  lastMessageAt: number;
  unreadCount: number;
  type?: string;
  createdBy?: string;
  disappearingMessageTimeout?: number;
}

export interface ChatParticipant {
  id: number;
  chatId: number;
  userId: string;
  role: string;
  joinedAt: number;
}

export interface MessageDraft {
  chatId: number;
  content: string;
  updatedAt: number;
}

export class ChatRepository extends BaseRepository {
  /**
   * Create a new chat
   */
  create(title: string, lastMessageAt: number, type: string = 'direct'): number {
    return this.insert('chats', {
      title,
      lastMessageAt,
      unreadCount: 0,
      type
    });
  }

  /**
   * Create a group chat with participants
   */
  createGroup(title: string, createdBy: string, participantIds: string[]): number | null {
    try {
      return this.transaction(() => {
        const now = Date.now();

        // Create the group chat
        const chatId = this.insert('chats', {
          title,
          lastMessageAt: now,
          unreadCount: 0,
          type: 'group',
          createdBy
        });

        // Add creator as admin
        this.addParticipant(chatId, createdBy, 'admin');

        // Add other participants as members
        for (const userId of participantIds) {
          if (userId !== createdBy) {
            this.addParticipant(chatId, userId, 'member');
          }
        }

        return chatId;
      });
    } catch (error) {
      console.error('[ChatRepository] Error creating group chat:', error);
      return null;
    }
  }

  /**
   * Get chat by ID
   */
  getById(chatId: number): Chat | undefined {
    const stmt = this.prepare(`
      SELECT id, title, lastMessageAt, unreadCount, disappearingMessageTimeout, type, createdBy
      FROM chats
      WHERE id = ?
    `);
    return stmt.get(chatId) as Chat | undefined;
  }

  /**
   * Get chat list with pagination
   */
  getList(limit: number = 50, offset: number = 0): Chat[] {
    const stmt = this.prepare(`
      SELECT id, title, lastMessageAt, unreadCount, disappearingMessageTimeout, type, createdBy
      FROM chats
      ORDER BY lastMessageAt DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as Chat[];
  }

  /**
   * Update last message timestamp
   */
  updateLastMessage(chatId: number, timestamp: number): boolean {
    const changes = this.update(
      'chats',
      { lastMessageAt: timestamp },
      'id = ?',
      chatId
    );
    return changes > 0;
  }

  /**
   * Increment unread count
   */
  incrementUnreadCount(chatId: number): boolean {
    const stmt = this.prepare(`
      UPDATE chats
      SET unreadCount = unreadCount + 1
      WHERE id = ?
    `);
    const result = stmt.run(chatId);
    return result.changes > 0;
  }

  /**
   * Reset unread count
   */
  resetUnreadCount(chatId: number): boolean {
    const changes = this.update(
      'chats',
      { unreadCount: 0 },
      'id = ?',
      chatId
    );
    return changes > 0;
  }

  /**
   * Update chat title
   */
  updateTitle(chatId: number, newTitle: string): boolean {
    const changes = this.update(
      'chats',
      { title: newTitle },
      'id = ?',
      chatId
    );
    return changes > 0;
  }

  /**
   * Delete a chat
   */
  deleteChat(chatId: number): boolean {
    const changes = this.delete('chats', 'id = ?', chatId);
    return changes > 0;
  }

  /**
   * Set disappearing message timeout
   */
  setDisappearingMessageTimeout(chatId: number, timeout: number | null): boolean {
    const changes = this.update(
      'chats',
      { disappearingMessageTimeout: timeout },
      'id = ?',
      chatId
    );
    return changes > 0;
  }

  // ============================================================================
  // Chat Participants
  // ============================================================================

  /**
   * Add a participant to a chat
   */
  addParticipant(chatId: number, userId: string, role: string = 'member'): number | null {
    try {
      return this.insert('chat_participants', {
        chatId,
        userId,
        role,
        joinedAt: Date.now()
      });
    } catch (error) {
      // Unique constraint violation - already a participant
      return null;
    }
  }

  /**
   * Remove a participant from a chat
   */
  removeParticipant(chatId: number, userId: string): boolean {
    const changes = this.delete(
      'chat_participants',
      'chatId = ? AND userId = ?',
      chatId, userId
    );
    return changes > 0;
  }

  /**
   * Get all participants for a chat
   */
  getParticipants(chatId: number): ChatParticipant[] {
    const stmt = this.prepare(`
      SELECT * FROM chat_participants
      WHERE chatId = ?
      ORDER BY joinedAt ASC
    `);
    return stmt.all(chatId) as ChatParticipant[];
  }

  /**
   * Get participant role
   */
  getParticipantRole(chatId: number, userId: string): 'admin' | 'member' | null {
    const stmt = this.prepare(`
      SELECT role FROM chat_participants
      WHERE chatId = ? AND userId = ?
    `);
    const result = stmt.get(chatId, userId) as { role: string } | undefined;
    return result ? (result.role as 'admin' | 'member') : null;
  }

  /**
   * Update participant role
   */
  updateParticipantRole(chatId: number, userId: string, newRole: string): boolean {
    const changes = this.update(
      'chat_participants',
      { role: newRole },
      'chatId = ? AND userId = ?',
      chatId, userId
    );
    return changes > 0;
  }

  /**
   * Check if user is participant
   */
  isParticipant(chatId: number, userId: string): boolean {
    const stmt = this.prepare(`
      SELECT 1 FROM chat_participants
      WHERE chatId = ? AND userId = ?
      LIMIT 1
    `);
    const result = stmt.get(chatId, userId);
    return result !== undefined;
  }

  // ============================================================================
  // Message Drafts
  // ============================================================================

  /**
   * Save a message draft
   */
  saveDraft(chatId: number, content: string): boolean {
    try {
      const stmt = this.prepare(`
        INSERT INTO message_drafts (chatId, content, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(chatId) DO UPDATE SET
          content = excluded.content,
          updatedAt = excluded.updatedAt
      `);
      stmt.run(chatId, content, Date.now());
      return true;
    } catch (error) {
      console.error('[ChatRepository] Error saving draft:', error);
      return false;
    }
  }

  /**
   * Get draft for a chat
   */
  getDraft(chatId: number): MessageDraft | undefined {
    const stmt = this.prepare(`
      SELECT * FROM message_drafts
      WHERE chatId = ?
    `);
    return stmt.get(chatId) as MessageDraft | undefined;
  }

  /**
   * Delete draft
   */
  deleteDraft(chatId: number): boolean {
    const changes = this.delete('message_drafts', 'chatId = ?', chatId);
    return changes > 0;
  }

  // ============================================================================
  // Chat Keys (for per-chat encryption)
  // ============================================================================

  /**
   * Store chat encryption keys
   */
  storeChatKeys(chatId: number, encryptedKeys: string, version: number = 1): void {
    const now = Date.now();
    const stmt = this.prepare(`
      INSERT INTO chat_keys (chatId, encryptedKeys, version, createdAt, lastRotatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(chatId) DO UPDATE SET
        encryptedKeys = excluded.encryptedKeys,
        version = excluded.version,
        lastRotatedAt = excluded.lastRotatedAt
    `);
    stmt.run(chatId, encryptedKeys, version, now, now);
  }

  /**
   * Get chat encryption keys
   */
  getChatKeys(chatId: number): {
    encryptedKeys: string;
    version: number;
    createdAt: number;
    lastRotatedAt: number;
  } | null {
    const stmt = this.prepare(`
      SELECT encryptedKeys, version, createdAt, lastRotatedAt
      FROM chat_keys
      WHERE chatId = ?
    `);
    return stmt.get(chatId) as any || null;
  }

  /**
   * Update chat keys (for rotation)
   */
  updateChatKeys(chatId: number, encryptedKeys: string, version: number): void {
    const now = Date.now();
    this.update(
      'chat_keys',
      { encryptedKeys, version, lastRotatedAt: now },
      'chatId = ?',
      chatId
    );
  }

  /**
   * Delete chat keys
   */
  deleteChatKeys(chatId: number): void {
    this.delete('chat_keys', 'chatId = ?', chatId);
  }

  /**
   * Get all chats needing key rotation
   */
  getChatsNeedingKeyRotation(daysThreshold: number = 30): number[] {
    const thresholdTimestamp = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);
    const stmt = this.prepare(`
      SELECT chatId
      FROM chat_keys
      WHERE lastRotatedAt < ?
    `);
    const rows = stmt.all(thresholdTimestamp) as { chatId: number }[];
    return rows.map(row => row.chatId);
  }

  // ============================================================================
  // Disappearing Messages
  // ============================================================================

  /**
   * Set disappearing message timeout for a chat
   */
  setDisappearingTimeout(chatId: number, timeout: number | null): boolean {
    const changes = this.update(
      'chats',
      { disappearingMessageTimeout: timeout },
      'id = ?',
      chatId
    );
    return changes > 0;
  }

  /**
   * Get disappearing message timeout for a chat
   */
  getDisappearingTimeout(chatId: number): number | null {
    const chat = this.getById(chatId);
    return chat?.disappearingMessageTimeout || null;
  }
}
