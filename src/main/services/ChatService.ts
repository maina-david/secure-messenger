import { BaseService } from './BaseService';
import { ChatRepository, Chat } from '../database/ChatRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';

export interface CreateChatOptions {
  title: string;
  type?: 'direct' | 'group';
  participantIds?: string[];
  createdBy?: string;
}

export class ChatService extends BaseService {
  private chatRepo: ChatRepository;

  constructor(dbConnection?: DatabaseConnection) {
    super(dbConnection);
    this.chatRepo = new ChatRepository(dbConnection);
  }

  /**
   * Create a new chat
   */
  async createChat(options: CreateChatOptions): Promise<number> {
    this.validateRequired(options, ['title']);

    const { title, type = 'direct', participantIds = [], createdBy } = options;

    const chatId = this.transaction(() => {
      if (type === 'group' && createdBy) {
        const result = this.chatRepo.createGroup(title, createdBy, participantIds);
        if (!result) {
          throw new Error('Failed to create group chat');
        }
        return result;
      } else {
        return this.chatRepo.create(title, Date.now(), type);
      }
    });

    const encryptedKeys = await this.security.initializeChatKeys(chatId);
    this.chatRepo.storeChatKeys(chatId, encryptedKeys);

    return chatId;
  }

  /**
   * Get chat by ID
   */
  getChat(chatId: number): Chat | null {
    return this.chatRepo.getById(chatId) || null;
  }

  /**
   * Get chat list
   */
  getChatList(limit: number = 50, offset: number = 0): Chat[] {
    return this.chatRepo.getList(limit, offset);
  }

  /**
   * Update chat title
   */
  updateChatTitle(chatId: number, newTitle: string): boolean {
    if (!newTitle || newTitle.trim().length === 0) {
      throw new Error('Chat title cannot be empty');
    }
    return this.chatRepo.updateTitle(chatId, newTitle.trim());
  }

  /**
   * Delete a chat
   */
  deleteChat(chatId: number): boolean {
    return this.transaction(() => {
      // Delete chat keys
      this.chatRepo.deleteChatKeys(chatId);
      // Delete chat (cascades to messages, participants, etc.)
      return this.chatRepo.deleteChat(chatId);
    });
  }

  /**
   * Add participant to group chat
   */
  addParticipant(chatId: number, userId: string, role: string = 'member'): boolean {
    // Verify chat exists and is a group
    const chat = this.chatRepo.getById(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    if (chat.type !== 'group') {
      throw new Error('Can only add participants to group chats');
    }

    const result = this.chatRepo.addParticipant(chatId, userId, role);
    return result !== null;
  }

  /**
   * Remove participant from group chat
   */
  removeParticipant(chatId: number, userId: string, removedBy: string): boolean {
    // Verify permissions
    const removerRole = this.chatRepo.getParticipantRole(chatId, removedBy);
    if (removerRole !== 'admin') {
      throw new Error('Only admins can remove participants');
    }

    return this.chatRepo.removeParticipant(chatId, userId);
  }

  /**
   * Update participant role
   */
  updateParticipantRole(
    chatId: number,
    userId: string,
    newRole: 'admin' | 'member',
    updatedBy: string
  ): boolean {
    // Verify permissions
    const updaterRole = this.chatRepo.getParticipantRole(chatId, updatedBy);
    if (updaterRole !== 'admin') {
      throw new Error('Only admins can change roles');
    }

    return this.chatRepo.updateParticipantRole(chatId, userId, newRole);
  }

  /**
   * Get chat participants
   */
  getParticipants(chatId: number) {
    return this.chatRepo.getParticipants(chatId);
  }

  /**
   * Check if user is participant
   */
  isParticipant(chatId: number, userId: string): boolean {
    return this.chatRepo.isParticipant(chatId, userId);
  }

  /**
   * Save message draft
   */
  saveDraft(chatId: number, content: string): boolean {
    return this.chatRepo.saveDraft(chatId, content);
  }

  /**
   * Get message draft
   */
  getDraft(chatId: number) {
    return this.chatRepo.getDraft(chatId);
  }

  /**
   * Delete message draft
   */
  deleteDraft(chatId: number): boolean {
    return this.chatRepo.deleteDraft(chatId);
  }

  /**
   * Reset unread count for a chat
   */
  resetUnreadCount(chatId: number): boolean {
    return this.chatRepo.resetUnreadCount(chatId);
  }

  /**
   * Set disappearing message timeout
   */
  setDisappearingMessages(chatId: number, timeoutMs: number | null): boolean {
    return this.chatRepo.setDisappearingMessageTimeout(chatId, timeoutMs);
  }

  /**
   * Set disappearing message timeout for a chat
   */
  setDisappearingTimeout(chatId: number, timeout: number | null): boolean {
    return this.chatRepo.setDisappearingTimeout(chatId, timeout);
  }

  /**
   * Get disappearing message timeout for a chat
   */
  getDisappearingTimeout(chatId: number): number | null {
    return this.chatRepo.getDisappearingTimeout(chatId);
  }

  /**
   * Rotate encryption keys for a chat
   */
  async rotateKeys(chatId: number): Promise<boolean> {
    const chatKeys = this.chatRepo.getChatKeys(chatId);
    if (!chatKeys) {
      throw new Error('Chat keys not found');
    }

    // Check if rotation is needed
    if (!this.security.needsKeyRotation(chatKeys.lastRotatedAt)) {
      console.log(`[ChatService] Keys for chat ${chatId} don't need rotation yet`);
      return false;
    }

    // Rotate keys
    const newEncryptedKeys = await this.security.rotateChatKeys(chatId, chatKeys.encryptedKeys);
    this.chatRepo.updateChatKeys(chatId, newEncryptedKeys, chatKeys.version + 1);

    console.log(`[ChatService] Keys rotated for chat ${chatId} to version ${chatKeys.version + 1}`);
    return true;
  }

  /**
   * Get all chats needing key rotation
   */
  getChatsNeedingKeyRotation(daysThreshold: number = 30): number[] {
    return this.chatRepo.getChatsNeedingKeyRotation(daysThreshold);
  }

  /**
   * Rotate keys for all chats that need it
   */
  async rotateAllExpiredKeys(): Promise<number> {
    const chatIds = this.getChatsNeedingKeyRotation();
    let rotatedCount = 0;

    for (const chatId of chatIds) {
      try {
        const rotated = await this.rotateKeys(chatId);
        if (rotated) rotatedCount++;
      } catch (error) {
        console.error(`[ChatService] Failed to rotate keys for chat ${chatId}:`, error);
      }
    }

    return rotatedCount;
  }
}
