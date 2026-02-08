import { BaseRepository } from './BaseRepository';

export interface Message {
  id: number;
  chatId: number;
  ts: number;
  sender: string;
  body: string;
  editedAt?: number;
  deletedAt?: number;
  isDeleted: number;
}

export interface MessageReaction {
  id: number;
  messageId: number;
  chatId: number;
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface ReadReceipt {
  messageId: number;
  userId: string;
  readAt: number;
}

export interface PinnedMessage {
  id: number;
  messageId: number;
  chatId: number;
  pinnedBy: string;
  pinnedAt: number;
}

export interface DeliveryStatus {
  delivered: boolean;
  deliveredAt: number | null;
}

export class MessageRepository extends BaseRepository {
  /**
   * Create a new message
   */
  create(chatId: number, ts: number, sender: string, body: string): number {
    return this.insert('messages', {
      chatId,
      ts,
      sender,
      body,
      isDeleted: 0
    });
  }

  /**
   * Get messages for a chat with pagination
   */
  getByChatId(chatId: number, limit: number = 50, offset: number = 0): Message[] {
    const stmt = this.prepare(`
      SELECT * FROM messages
      WHERE chatId = ? AND isDeleted = 0
      ORDER BY ts DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(chatId, limit, offset) as Message[];
  }

  /**
   * Get a single message by ID
   */
  getById(messageId: number): Message | undefined {
    const stmt = this.prepare('SELECT * FROM messages WHERE id = ?');
    return stmt.get(messageId) as Message | undefined;
  }

  /**
   * Get messages before a timestamp (for infinite scroll)
   */
  getBeforeTimestamp(chatId: number, timestamp: number, limit: number = 50): Message[] {
    const stmt = this.prepare(`
      SELECT * FROM messages
      WHERE chatId = ? AND ts < ? AND isDeleted = 0
      ORDER BY ts DESC
      LIMIT ?
    `);
    return stmt.all(chatId, timestamp, limit) as Message[];
  }

  /**
   * Get messages after a timestamp (for sync)
   */
  getAfterTimestamp(chatId: number, timestamp: number, limit: number = 50): Message[] {
    const stmt = this.prepare(`
      SELECT * FROM messages
      WHERE chatId = ? AND ts > ? AND isDeleted = 0
      ORDER BY ts ASC
      LIMIT ?
    `);
    return stmt.all(chatId, timestamp, limit) as Message[];
  }

  /**
   * Update message body (for editing)
   */
  updateBody(messageId: number, newBody: string): boolean {
    const now = Date.now();
    const changes = this.update(
      'messages',
      { body: newBody, editedAt: now },
      'id = ?',
      messageId
    );
    return changes > 0;
  }

  /**
   * Soft delete a message
   */
  softDelete(messageId: number): boolean {
    const now = Date.now();
    const changes = this.update(
      'messages',
      { isDeleted: 1, deletedAt: now },
      'id = ?',
      messageId
    );
    return changes > 0;
  }

  /**
   * Hard delete a message
   */
  hardDelete(messageId: number): boolean {
    const changes = this.delete('messages', 'id = ?', messageId);
    return changes > 0;
  }

  /**
   * Count messages in a chat
   */
  countByChatId(chatId: number): number {
    return this.count('messages', 'chatId = ? AND isDeleted = 0', chatId);
  }

  /**
   * Get last message for a chat
   */
  getLastMessage(chatId: number): Message | undefined {
    const stmt = this.prepare(`
      SELECT * FROM messages
      WHERE chatId = ? AND isDeleted = 0
      ORDER BY ts DESC
      LIMIT 1
    `);
    return stmt.get(chatId) as Message | undefined;
  }

  /**
   * Get last messages for multiple chats in a single query (batch operation)
   */
  getLastMessagesBatch(chatIds: number[]): Map<number, Message> {
    if (chatIds.length === 0) return new Map();

    const placeholders = chatIds.map(() => '?').join(',');
    const stmt = this.prepare(`
      SELECT m.*
      FROM messages m
      INNER JOIN (
        SELECT chatId, MAX(ts) as maxTs
        FROM messages
        WHERE chatId IN (${placeholders}) AND isDeleted = 0
        GROUP BY chatId
      ) latest ON m.chatId = latest.chatId AND m.ts = latest.maxTs
    `);

    const messages = stmt.all(...chatIds) as Message[];
    const map = new Map<number, Message>();
    messages.forEach(msg => map.set(msg.chatId, msg));
    return map;
  }

  /**
   * Search messages (for encrypted content, this will need special handling)
   */
  search(query: string, limit: number = 50): Message[] {
    const stmt = this.prepare(`
      SELECT * FROM messages
      WHERE body LIKE ? AND isDeleted = 0
      ORDER BY ts DESC
      LIMIT ?
    `);
    return stmt.all(`%${query}%`, limit) as Message[];
  }

  // ============================================================================
  // Message Reactions
  // ============================================================================

  /**
   * Add a reaction to a message
   */
  addReaction(messageId: number, chatId: number, userId: string, emoji: string): number | null {
    try {
      return this.insert('message_reactions', {
        messageId,
        chatId,
        userId,
        emoji,
        createdAt: Date.now()
      });
    } catch (error) {
      // Unique constraint violation - reaction already exists
      return null;
    }
  }

  /**
   * Remove a reaction
   */
  removeReaction(messageId: number, userId: string, emoji: string): boolean {
    const changes = this.delete(
      'message_reactions',
      'messageId = ? AND userId = ? AND emoji = ?',
      messageId, userId, emoji
    );
    return changes > 0;
  }

  /**
   * Get reactions for a message
   */
  getReactions(messageId: number): MessageReaction[] {
    const stmt = this.prepare(`
      SELECT * FROM message_reactions
      WHERE messageId = ?
      ORDER BY createdAt ASC
    `);
    return stmt.all(messageId) as MessageReaction[];
  }

  // ============================================================================
  // Read Receipts
  // ============================================================================

  /**
   * Mark message as read
   */
  markAsRead(messageId: number, userId: string): boolean {
    try {
      this.insert('read_receipts', {
        messageId,
        userId,
        readAt: Date.now()
      });
      return true;
    } catch (error) {
      // Already marked as read
      return false;
    }
  }

  /**
   * Get read receipts for a message
   */
  getReadReceipts(messageId: number): ReadReceipt[] {
    const stmt = this.prepare(`
      SELECT * FROM read_receipts
      WHERE messageId = ?
      ORDER BY readAt DESC
    `);
    return stmt.all(messageId) as ReadReceipt[];
  }

  /**
   * Mark all messages in a chat as read
   */
  markChatAsRead(chatId: number, userId: string, upToTimestamp?: number): number {
    const now = Date.now();
    let insertedCount = 0;

    // Get unread messages
    const query = upToTimestamp
      ? `SELECT id FROM messages WHERE chatId = ? AND ts <= ? AND isDeleted = 0`
      : `SELECT id FROM messages WHERE chatId = ? AND isDeleted = 0`;

    const stmt = upToTimestamp
      ? this.prepare(query)
      : this.prepare(query);

    const messages = upToTimestamp
      ? stmt.all(chatId, upToTimestamp) as { id: number }[]
      : stmt.all(chatId) as { id: number }[];

    // Insert read receipts for messages that don't have one yet
    for (const msg of messages) {
      try {
        this.insert('read_receipts', {
          messageId: msg.id,
          userId,
          readAt: now
        });
        insertedCount++;
      } catch (error) {
        // Already marked as read, skip
      }
    }

    return insertedCount;
  }

  /**
   * Get reactions for all messages in a chat, grouped by messageId
   */
  getReactionsByChat(chatId: number): Record<number, MessageReaction[]> {
    const stmt = this.prepare(`
      SELECT id, messageId, chatId, userId, emoji, createdAt
      FROM message_reactions
      WHERE chatId = ?
      ORDER BY messageId, createdAt ASC
    `);
    const reactions = stmt.all(chatId) as MessageReaction[];

    // Group by messageId
    const grouped: Record<number, MessageReaction[]> = {};
    for (const reaction of reactions) {
      if (!grouped[reaction.messageId]) {
        grouped[reaction.messageId] = [];
      }
      grouped[reaction.messageId].push(reaction);
    }

    return grouped;
  }

  /**
   * Get read receipts for all messages in a chat, grouped by messageId
   */
  getReadReceiptsByChat(chatId: number): Record<number, ReadReceipt[]> {
    const stmt = this.prepare(`
      SELECT r.messageId, r.userId, r.readAt
      FROM read_receipts r
      INNER JOIN messages m ON r.messageId = m.id
      WHERE m.chatId = ?
      ORDER BY r.messageId, r.readAt ASC
    `);
    const receipts = stmt.all(chatId) as ReadReceipt[];

    // Group by messageId
    const grouped: Record<number, ReadReceipt[]> = {};
    for (const receipt of receipts) {
      if (!grouped[receipt.messageId]) {
        grouped[receipt.messageId] = [];
      }
      grouped[receipt.messageId].push(receipt);
    }

    return grouped;
  }

  // ============================================================================
  // Delivery Status
  // ============================================================================

  /**
   * Mark message as delivered
   */
  markMessageDelivered(messageId: number): boolean {
    const now = Date.now();
    const changes = this.update(
      'messages',
      { deliveredAt: now },
      'id = ? AND deliveredAt IS NULL',
      messageId
    );
    return changes > 0;
  }

  /**
   * Get delivery status for a message
   */
  getDeliveryStatus(messageId: number): DeliveryStatus {
    const stmt = this.prepare(`
      SELECT deliveredAt
      FROM messages
      WHERE id = ?
    `);
    const result = stmt.get(messageId) as { deliveredAt: number | null } | undefined;
    return {
      delivered: result?.deliveredAt !== null && result?.deliveredAt !== undefined,
      deliveredAt: result?.deliveredAt || null,
    };
  }

  // ============================================================================
  // Global Search
  // ============================================================================

  /**
   * Search messages across all chats (for encrypted content, needs client-side search)
   */
  searchAllChats(query: string, limit: number = 50): Message[] {
    const stmt = this.prepare(`
      SELECT id, chatId, ts, sender, body, editedAt, deletedAt, isDeleted
      FROM messages
      WHERE body LIKE ? AND isDeleted = 0
      ORDER BY ts DESC
      LIMIT ?
    `);
    return stmt.all(`%${query}%`, limit) as Message[];
  }

  // ============================================================================
  // Message Replies
  // ============================================================================

  /**
   * Set a message as a reply to another message
   */
  setMessageReply(messageId: number, replyToMessageId: number): boolean {
    try {
      const stmt = this.prepare(`
        INSERT INTO message_replies (messageId, replyToMessageId)
        VALUES (?, ?)
        ON CONFLICT(messageId) DO UPDATE SET replyToMessageId = ?
      `);
      stmt.run(messageId, replyToMessageId, replyToMessageId);
      return true;
    } catch (error) {
      console.error('[MessageRepository] Error setting message reply:', error);
      return false;
    }
  }

  /**
   * Get which message this message is replying to
   */
  getMessageReply(messageId: number): number | null {
    const stmt = this.prepare(`
      SELECT replyToMessageId FROM message_replies WHERE messageId = ?
    `);
    const result = stmt.get(messageId) as { replyToMessageId: number } | undefined;
    return result?.replyToMessageId || null;
  }

  /**
   * Get all messages that reply to this message
   */
  getRepliesTo(messageId: number): Message[] {
    const stmt = this.prepare(`
      SELECT m.id, m.chatId, m.ts, m.sender, m.body, m.editedAt, m.deletedAt, m.isDeleted
      FROM messages m
      INNER JOIN message_replies r ON m.id = r.messageId
      WHERE r.replyToMessageId = ? AND m.isDeleted = 0
      ORDER BY m.ts ASC
    `);
    return stmt.all(messageId) as Message[];
  }

  /**
   * Delete a message reply relationship
   */
  deleteMessageReply(messageId: number): boolean {
    const changes = this.delete('message_replies', 'messageId = ?', messageId);
    return changes > 0;
  }

  // ============================================================================
  // Pinned Messages
  // ============================================================================

  /**
   * Pin a message in a chat
   */
  pinMessage(messageId: number, chatId: number, pinnedBy: string): number | null {
    try {
      return this.insert('pinned_messages', {
        messageId,
        chatId,
        pinnedBy,
        pinnedAt: Date.now()
      });
    } catch (error) {
      // Unique constraint violation - message already pinned
      console.error('[MessageRepository] Error pinning message:', error);
      return null;
    }
  }

  /**
   * Unpin a message from a chat
   */
  unpinMessage(messageId: number, chatId: number): boolean {
    const changes = this.delete(
      'pinned_messages',
      'messageId = ? AND chatId = ?',
      messageId, chatId
    );
    return changes > 0;
  }

  /**
   * Get all pinned messages in a chat
   */
  getPinnedMessages(chatId: number): PinnedMessage[] {
    const stmt = this.prepare(`
      SELECT id, messageId, chatId, pinnedBy, pinnedAt
      FROM pinned_messages
      WHERE chatId = ?
      ORDER BY pinnedAt DESC
    `);
    return stmt.all(chatId) as PinnedMessage[];
  }

  /**
   * Check if a message is pinned
   */
  isPinned(messageId: number, chatId: number): boolean {
    const count = this.count(
      'pinned_messages',
      'messageId = ? AND chatId = ?',
      messageId, chatId
    );
    return count > 0;
  }

  // ============================================================================
  // Message Forwarding
  // ============================================================================

  /**
   * Forward a message to another chat (creates new message with encrypted body)
   */
  forwardMessage(originalMessageId: number, targetChatId: number, sender: string, encryptedBody: string): number | null {
    try {
      const timestamp = Date.now();

      // Create the forwarded message
      const messageId = this.insert('messages', {
        chatId: targetChatId,
        ts: timestamp,
        sender,
        body: encryptedBody,
        forwardedFrom: originalMessageId,
        forwardCount: 0,
        isDeleted: 0
      });

      // Increment forward count on original message
      this.incrementForwardCount(originalMessageId);

      return messageId;
    } catch (error) {
      console.error('[MessageRepository] Error forwarding message:', error);
      return null;
    }
  }

  /**
   * Increment forward count for a message
   */
  incrementForwardCount(messageId: number): boolean {
    const stmt = this.prepare(`
      UPDATE messages
      SET forwardCount = forwardCount + 1
      WHERE id = ?
    `);
    const result = stmt.run(messageId);
    return result.changes > 0;
  }

  // ============================================================================
  // Disappearing Messages
  // ============================================================================

  /**
   * Get all expired messages
   */
  getExpiredMessages(): Message[] {
    const now = Date.now();
    const stmt = this.prepare(`
      SELECT * FROM messages
      WHERE expiresAt IS NOT NULL AND expiresAt < ?
    `);
    return stmt.all(now) as Message[];
  }

  /**
   * Delete all expired messages
   */
  cleanupExpiredMessages(): number {
    const now = Date.now();
    const stmt = this.prepare(`
      DELETE FROM messages
      WHERE expiresAt IS NOT NULL AND expiresAt < ?
    `);
    const result = stmt.run(now);
    return result.changes;
  }

  // ============================================================================
  // Advanced Search
  // ============================================================================

  /**
   * Advanced search with filters
   */
  searchAdvanced(options: {
    query: string;
    chatId?: number;
    sender?: string;
    dateFrom?: number;
    dateTo?: number;
    limit?: number;
  }): Message[] {
    const { query, chatId, sender, dateFrom, dateTo, limit = 50 } = options;

    let sql = 'SELECT * FROM messages WHERE isDeleted = 0';
    const params: any[] = [];

    if (query) {
      sql += ' AND body LIKE ?';
      params.push(`%${query}%`);
    }

    if (chatId !== undefined) {
      sql += ' AND chatId = ?';
      params.push(chatId);
    }

    if (sender) {
      sql += ' AND sender = ?';
      params.push(sender);
    }

    if (dateFrom !== undefined) {
      sql += ' AND ts >= ?';
      params.push(dateFrom);
    }

    if (dateTo !== undefined) {
      sql += ' AND ts <= ?';
      params.push(dateTo);
    }

    sql += ' ORDER BY ts DESC LIMIT ?';
    params.push(limit);

    const stmt = this.prepare(sql);
    return stmt.all(...params) as Message[];
  }

  /**
   * Get all unique senders
   */
  getAllSenders(): string[] {
    const stmt = this.prepare(`
      SELECT DISTINCT sender
      FROM messages
      WHERE isDeleted = 0
      ORDER BY sender
    `);
    const rows = stmt.all() as { sender: string }[];
    return rows.map(row => row.sender);
  }
}
