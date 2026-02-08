import { BaseService } from './BaseService';
import { ScheduledMessageRepository, ScheduledMessage } from '../database/ScheduledMessageRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';

export class ScheduledMessageService extends BaseService {
  private scheduledMessageRepo: ScheduledMessageRepository;

  constructor(dbConnection?: DatabaseConnection) {
    super(dbConnection);
    this.scheduledMessageRepo = new ScheduledMessageRepository(dbConnection);
  }

  /**
   * Schedule a message
   */
  scheduleMessage(chatId: number, sender: string, body: string, scheduledFor: number): number {
    this.validateRequired({ chatId, sender, body, scheduledFor }, ['chatId', 'sender', 'body', 'scheduledFor']);

    if (scheduledFor <= Date.now()) {
      throw new Error('Scheduled time must be in the future');
    }

    if (body.trim().length === 0) {
      throw new Error('Message body cannot be empty');
    }

    return this.scheduledMessageRepo.scheduleMessage(chatId, sender, body, scheduledFor);
  }

  /**
   * Get a scheduled message by ID
   */
  getScheduledMessage(id: number): ScheduledMessage | null {
    return this.scheduledMessageRepo.getScheduledMessage(id) || null;
  }

  /**
   * Get scheduled messages for a chat, optionally filtered by status
   */
  getScheduledMessages(chatId: number, status?: 'pending' | 'sent' | 'cancelled'): ScheduledMessage[] {
    return this.scheduledMessageRepo.getScheduledMessages(chatId, status);
  }

  /**
   * Get all pending scheduled messages
   */
  getAllPendingScheduledMessages(): ScheduledMessage[] {
    return this.scheduledMessageRepo.getAllPendingScheduledMessages();
  }

  /**
   * Cancel a scheduled message
   */
  cancelScheduledMessage(id: number): boolean {
    return this.scheduledMessageRepo.cancelScheduledMessage(id);
  }

  /**
   * Delete a scheduled message
   */
  deleteScheduledMessage(id: number): boolean {
    return this.scheduledMessageRepo.deleteScheduledMessage(id);
  }

  /**
   * Get scheduled messages that are due to be sent
   */
  getDueScheduledMessages(): ScheduledMessage[] {
    return this.scheduledMessageRepo.getDueScheduledMessages();
  }

  /**
   * Mark a scheduled message as sent
   */
  markScheduledMessageSent(id: number, messageId: number): boolean {
    return this.scheduledMessageRepo.markScheduledMessageSent(id, messageId);
  }
}
