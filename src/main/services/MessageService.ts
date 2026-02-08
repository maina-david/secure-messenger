import { BaseService } from './BaseService';
import {
  MessageRepository,
  Message,
  MessageReaction,
  ReadReceipt,
  PinnedMessage,
  DeliveryStatus
} from '../database/MessageRepository';
import { ChatRepository } from '../database/ChatRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';

export interface SendMessageOptions {
  chatId: number;
  sender: string;
  body: string;
  timestamp?: number;
}

export interface DecryptedMessage extends Omit<Message, 'body'> {
  body: string; // Decrypted body
}

export class MessageService extends BaseService {
  private messageRepo: MessageRepository;
  private chatRepo: ChatRepository;

  constructor(dbConnection?: DatabaseConnection) {
    super(dbConnection);
    this.messageRepo = new MessageRepository(dbConnection);
    this.chatRepo = new ChatRepository(dbConnection);
  }

  /**
   * Send a new message with encryption
   */
  async sendMessage(options: SendMessageOptions): Promise<DecryptedMessage> {
    this.validateRequired(options, ['chatId', 'sender', 'body']);

    const { chatId, sender, body, timestamp = Date.now() } = options;

    // Get or create chat encryption keys (ASYNC - outside transaction)
    let chatKeys = this.chatRepo.getChatKeys(chatId);
    if (!chatKeys) {
      // Initialize keys for new chat
      const encryptedKeys = await this.security.initializeChatKeys(chatId);
      this.chatRepo.storeChatKeys(chatId, encryptedKeys);
      chatKeys = this.chatRepo.getChatKeys(chatId);
    }

    // Decrypt chat keys (ASYNC - outside transaction)
    const keys = await this.security.getChatKeys(chatId, chatKeys!.encryptedKeys);

    // Encrypt message body (SYNC - outside transaction)
    const encryptedBody = this.security.encryptForChat(chatId, body, keys);

    // Transaction contains ONLY synchronous database operations
    const messageId = this.transaction(() => {
      // Store encrypted message
      const id = this.messageRepo.create(chatId, timestamp, sender, encryptedBody);

      // Update chat's last message timestamp
      this.chatRepo.updateLastMessage(chatId, timestamp);

      return id;
    });

    // Return decrypted message for immediate display
    return {
      id: messageId,
      chatId,
      ts: timestamp,
      sender,
      body, // Original plaintext
      isDeleted: 0
    };
  }

  /**
   * Get messages for a chat with decryption
   */
  async getMessages(
    chatId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<DecryptedMessage[]> {
    const messages = this.messageRepo.getByChatId(chatId, limit, offset);
    return this.decryptMessages(chatId, messages);
  }

  /**
   * Get messages before a timestamp (for infinite scroll)
   */
  async getMessagesBefore(
    chatId: number,
    timestamp: number,
    limit: number = 50
  ): Promise<DecryptedMessage[]> {
    const messages = this.messageRepo.getBeforeTimestamp(chatId, timestamp, limit);
    return this.decryptMessages(chatId, messages);
  }

  /**
   * Get messages after a timestamp (for sync)
   */
  async getMessagesAfter(
    chatId: number,
    timestamp: number,
    limit: number = 50
  ): Promise<DecryptedMessage[]> {
    const messages = this.messageRepo.getAfterTimestamp(chatId, timestamp, limit);
    return this.decryptMessages(chatId, messages);
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: number, newBody: string): Promise<boolean> {
    const message = this.messageRepo.getById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Get chat keys
    const chatKeys = this.chatRepo.getChatKeys(message.chatId);
    if (!chatKeys) {
      throw new Error('Chat keys not found');
    }

    // Decrypt keys and encrypt new body
    const keys = await this.security.getChatKeys(message.chatId, chatKeys.encryptedKeys);
    const encryptedBody = this.security.encryptForChat(message.chatId, newBody, keys);

    return this.messageRepo.updateBody(messageId, encryptedBody);
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: number): Promise<boolean> {
    return this.messageRepo.softDelete(messageId);
  }

  /**
   * Add a reaction to a message
   */
  addReaction(messageId: number, chatId: number, userId: string, emoji: string): boolean {
    const result = this.messageRepo.addReaction(messageId, chatId, userId, emoji);
    return result !== null;
  }

  /**
   * Remove a reaction from a message
   */
  removeReaction(messageId: number, userId: string, emoji: string): boolean {
    return this.messageRepo.removeReaction(messageId, userId, emoji);
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId: number, userId: string): boolean {
    return this.messageRepo.markAsRead(messageId, userId);
  }

  /**
   * Mark all messages in a chat as read
   */
  markChatAsRead(chatId: number, userId: string, upToTimestamp?: number): number {
    return this.messageRepo.markChatAsRead(chatId, userId, upToTimestamp);
  }

  /**
   * Search messages (requires decryption, so this is slow)
   * For production, implement client-side search index
   */
  async searchMessages(query: string, limit: number = 50): Promise<DecryptedMessage[]> {
    // Note: This won't work well with encrypted messages
    // In production, maintain a client-side search index (Fuse.js)
    const messages = this.messageRepo.search(query, limit);

    // Group messages by chat for efficient decryption
    const messagesByChatId = new Map<number, Message[]>();
    for (const msg of messages) {
      if (!messagesByChatId.has(msg.chatId)) {
        messagesByChatId.set(msg.chatId, []);
      }
      messagesByChatId.get(msg.chatId)!.push(msg);
    }

    // Decrypt messages per chat
    const decrypted: DecryptedMessage[] = [];
    for (const [chatId, chatMessages] of messagesByChatId) {
      const decryptedChatMessages = await this.decryptMessages(chatId, chatMessages);
      decrypted.push(...decryptedChatMessages);
    }

    // Filter by query after decryption
    return decrypted.filter(msg =>
      msg.body.toLowerCase().includes(query.toLowerCase())
    );
  }

  /**
   * Get last message for a chat with decryption
   */
  async getLastMessage(chatId: number): Promise<DecryptedMessage | null> {
    const message = this.messageRepo.getLastMessage(chatId);
    if (!message) return null;

    const decrypted = await this.decryptMessages(chatId, [message]);
    return decrypted[0] || null;
  }

  /**
   * Get last messages for multiple chats (batch operation)
   */
  async getLastMessagesBatch(chatIds: number[]): Promise<Map<number, DecryptedMessage>> {
    const messagesMap = this.messageRepo.getLastMessagesBatch(chatIds);
    const result = new Map<number, DecryptedMessage>();

    // Decrypt each message
    for (const [chatId, message] of messagesMap) {
      const decrypted = await this.decryptMessages(chatId, [message]);
      if (decrypted[0]) {
        result.set(chatId, decrypted[0]);
      }
    }

    return result;
  }

  /**
   * Get reactions for a message
   */
  getReactions(messageId: number): MessageReaction[] {
    return this.messageRepo.getReactions(messageId);
  }

  /**
   * Get reactions for all messages in a chat
   */
  getReactionsByChat(chatId: number): Record<number, MessageReaction[]> {
    return this.messageRepo.getReactionsByChat(chatId);
  }

  /**
   * Get read receipts for a message
   */
  getReadReceipts(messageId: number): ReadReceipt[] {
    return this.messageRepo.getReadReceipts(messageId);
  }

  /**
   * Get read receipts for all messages in a chat
   */
  getReadReceiptsByChat(chatId: number): Record<number, ReadReceipt[]> {
    return this.messageRepo.getReadReceiptsByChat(chatId);
  }

  /**
   * Mark message as delivered
   */
  markMessageDelivered(messageId: number): boolean {
    return this.messageRepo.markMessageDelivered(messageId);
  }

  /**
   * Get delivery status for a message
   */
  getDeliveryStatus(messageId: number): DeliveryStatus {
    return this.messageRepo.getDeliveryStatus(messageId);
  }

  /**
   * Search messages across all chats (client-side decryption required)
   */
  async searchMessagesAllChats(query: string, limit: number = 50): Promise<DecryptedMessage[]> {
    const messages = this.messageRepo.searchAllChats(query, limit);

    // Group messages by chat for efficient decryption
    const messagesByChatId = new Map<number, Message[]>();
    for (const msg of messages) {
      if (!messagesByChatId.has(msg.chatId)) {
        messagesByChatId.set(msg.chatId, []);
      }
      messagesByChatId.get(msg.chatId)!.push(msg);
    }

    // Decrypt messages per chat
    const decrypted: DecryptedMessage[] = [];
    for (const [chatId, chatMessages] of messagesByChatId) {
      const decryptedChatMessages = await this.decryptMessages(chatId, chatMessages);
      decrypted.push(...decryptedChatMessages);
    }

    return decrypted;
  }

  /**
   * Set a message as a reply to another message
   */
  setMessageReply(messageId: number, replyToMessageId: number): boolean {
    return this.messageRepo.setMessageReply(messageId, replyToMessageId);
  }

  /**
   * Get which message this message is replying to
   */
  getMessageReply(messageId: number): number | null {
    return this.messageRepo.getMessageReply(messageId);
  }

  /**
   * Get all messages that reply to this message
   */
  async getRepliesTo(messageId: number): Promise<DecryptedMessage[]> {
    const message = this.messageRepo.getById(messageId);
    if (!message) return [];

    const replies = this.messageRepo.getRepliesTo(messageId);
    return this.decryptMessages(message.chatId, replies);
  }

  /**
   * Delete a message reply relationship
   */
  deleteMessageReply(messageId: number): boolean {
    return this.messageRepo.deleteMessageReply(messageId);
  }

  /**
   * Pin a message in a chat
   */
  pinMessage(messageId: number, chatId: number, pinnedBy: string): number | null {
    return this.messageRepo.pinMessage(messageId, chatId, pinnedBy);
  }

  /**
   * Unpin a message from a chat
   */
  unpinMessage(messageId: number, chatId: number): boolean {
    return this.messageRepo.unpinMessage(messageId, chatId);
  }

  /**
   * Get all pinned messages in a chat
   */
  getPinnedMessages(chatId: number): PinnedMessage[] {
    return this.messageRepo.getPinnedMessages(chatId);
  }

  /**
   * Check if a message is pinned
   */
  isPinned(messageId: number, chatId: number): boolean {
    return this.messageRepo.isPinned(messageId, chatId);
  }

  /**
   * Forward a message to another chat with re-encryption
   */
  async forwardMessage(originalMessageId: number, targetChatId: number, sender: string): Promise<DecryptedMessage | null> {
    return this.asyncTransaction(async () => {
      // Get the original message
      const originalMessage = this.messageRepo.getById(originalMessageId);
      if (!originalMessage || originalMessage.isDeleted) {
        return null;
      }

      // Decrypt the original message
      const decrypted = await this.decryptMessages(originalMessage.chatId, [originalMessage]);
      if (decrypted.length === 0) {
        return null;
      }

      const plainBody = decrypted[0].body;

      // Get or create target chat encryption keys
      let targetChatKeys = this.chatRepo.getChatKeys(targetChatId);
      if (!targetChatKeys) {
        const encryptedKeys = await this.security.initializeChatKeys(targetChatId);
        this.chatRepo.storeChatKeys(targetChatId, encryptedKeys);
        targetChatKeys = this.chatRepo.getChatKeys(targetChatId);
      }

      // Encrypt message body for target chat
      const keys = await this.security.getChatKeys(targetChatId, targetChatKeys!.encryptedKeys);
      const encryptedBody = this.security.encryptForChat(targetChatId, plainBody, keys);

      // Forward the message in repository
      const messageId = this.messageRepo.forwardMessage(originalMessageId, targetChatId, sender, encryptedBody);
      if (!messageId) {
        return null;
      }

      // Update target chat's last message timestamp
      const timestamp = Date.now();
      this.chatRepo.updateLastMessage(targetChatId, timestamp);

      // Return decrypted message for immediate display
      return {
        id: messageId,
        chatId: targetChatId,
        ts: timestamp,
        sender,
        body: plainBody,
        isDeleted: 0
      };
    });
  }

  /**
   * Get a message by ID with decryption
   */
  async getMessageById(messageId: number): Promise<DecryptedMessage | null> {
    const message = this.messageRepo.getById(messageId);
    if (!message) return null;

    const decrypted = await this.decryptMessages(message.chatId, [message]);
    return decrypted[0] || null;
  }

  /**
   * Get all expired messages
   */
  async getExpiredMessages(): Promise<DecryptedMessage[]> {
    const messages = this.messageRepo.getExpiredMessages();

    // Group messages by chat for efficient decryption
    const messagesByChatId = new Map<number, Message[]>();
    for (const msg of messages) {
      if (!messagesByChatId.has(msg.chatId)) {
        messagesByChatId.set(msg.chatId, []);
      }
      messagesByChatId.get(msg.chatId)!.push(msg);
    }

    // Decrypt messages per chat
    const decrypted: DecryptedMessage[] = [];
    for (const [chatId, chatMessages] of messagesByChatId) {
      const decryptedChatMessages = await this.decryptMessages(chatId, chatMessages);
      decrypted.push(...decryptedChatMessages);
    }

    return decrypted;
  }

  /**
   * Cleanup expired messages
   */
  cleanupExpiredMessages(): number {
    return this.messageRepo.cleanupExpiredMessages();
  }

  /**
   * Advanced search with filters (requires client-side decryption)
   */
  async searchMessagesAdvanced(options: {
    query: string;
    chatId?: number;
    sender?: string;
    dateFrom?: number;
    dateTo?: number;
    limit?: number;
  }): Promise<DecryptedMessage[]> {
    const messages = this.messageRepo.searchAdvanced(options);

    // Group messages by chat for efficient decryption
    const messagesByChatId = new Map<number, Message[]>();
    for (const msg of messages) {
      if (!messagesByChatId.has(msg.chatId)) {
        messagesByChatId.set(msg.chatId, []);
      }
      messagesByChatId.get(msg.chatId)!.push(msg);
    }

    // Decrypt messages per chat
    const decrypted: DecryptedMessage[] = [];
    for (const [chatId, chatMessages] of messagesByChatId) {
      const decryptedChatMessages = await this.decryptMessages(chatId, chatMessages);
      decrypted.push(...decryptedChatMessages);
    }

    // Filter by query after decryption if query exists
    if (options.query) {
      return decrypted.filter(msg =>
        msg.body.toLowerCase().includes(options.query.toLowerCase())
      );
    }

    return decrypted;
  }

  /**
   * Get all unique senders
   */
  getAllSenders(): string[] {
    return this.messageRepo.getAllSenders();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Decrypt multiple messages from the same chat
   */
  private async decryptMessages(chatId: number, messages: Message[]): Promise<DecryptedMessage[]> {
    if (messages.length === 0) return [];

    try {
      // Get chat keys once for all messages
      const chatKeys = this.chatRepo.getChatKeys(chatId);
      if (!chatKeys) {
        console.warn(`[MessageService] No chat keys found for chat ${chatId}`);
        // Return messages with body indicating missing keys
        return messages.map(msg => ({
          ...msg,
          body: '[No encryption keys - reseed database]'
        }));
      }

      // Decrypt the chat keys (may fail if keys are from different master key)
      let keys;
      try {
        keys = await this.security.getChatKeys(chatId, chatKeys.encryptedKeys);
      } catch (error) {
        console.error(`[MessageService] Failed to decrypt chat keys for chat ${chatId}:`, error);
        // Return messages indicating key decryption failure
        return messages.map(msg => ({
          ...msg,
          body: '[Key decryption failed - reseed database]'
        }));
      }

      // Decrypt each message body
      return messages.map(msg => {
        try {
          const decryptedBody = this.security.decryptForChat(chatId, msg.body, keys);
          return {
            ...msg,
            body: decryptedBody
          };
        } catch (error) {
          console.error(`[MessageService] Failed to decrypt message ${msg.id}:`, error);
          return {
            ...msg,
            body: '[Decryption failed]'
          };
        }
      });
    } catch (error) {
      console.error(`[MessageService] Failed to decrypt messages for chat ${chatId}:`, error);
      return messages as DecryptedMessage[];
    }
  }
}
