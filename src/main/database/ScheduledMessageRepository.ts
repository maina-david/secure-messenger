import { BaseRepository } from './BaseRepository';

export interface ScheduledMessage {
  id: number;
  chatId: number;
  sender: string;
  body: string;
  scheduledFor: number;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: number;
  sentAt?: number | null;
}

export class ScheduledMessageRepository extends BaseRepository {
  /**
   * Schedule a message
   */
  scheduleMessage(chatId: number, sender: string, body: string, scheduledFor: number): number {
    return this.insert('scheduled_messages', {
      chatId,
      sender,
      body,
      scheduledFor,
      status: 'pending',
      createdAt: Date.now()
    });
  }

  /**
   * Get a scheduled message by ID
   */
  getScheduledMessage(id: number): ScheduledMessage | undefined {
    const stmt = this.prepare(`
      SELECT id, chatId, sender, body, scheduledFor, status, createdAt, sentAt
      FROM scheduled_messages
      WHERE id = ?
    `);
    return stmt.get(id) as ScheduledMessage | undefined;
  }

  /**
   * Get scheduled messages for a chat, optionally filtered by status
   */
  getScheduledMessages(chatId: number, status?: 'pending' | 'sent' | 'cancelled'): ScheduledMessage[] {
    let sql = `
      SELECT id, chatId, sender, body, scheduledFor, status, createdAt, sentAt
      FROM scheduled_messages
      WHERE chatId = ?
    `;
    const params: any[] = [chatId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY scheduledFor ASC';

    const stmt = this.prepare(sql);
    return stmt.all(...params) as ScheduledMessage[];
  }

  /**
   * Get all pending scheduled messages
   */
  getAllPendingScheduledMessages(): ScheduledMessage[] {
    const stmt = this.prepare(`
      SELECT id, chatId, sender, body, scheduledFor, status, createdAt, sentAt
      FROM scheduled_messages
      WHERE status = 'pending'
      ORDER BY scheduledFor ASC
    `);
    return stmt.all() as ScheduledMessage[];
  }

  /**
   * Cancel a scheduled message
   */
  cancelScheduledMessage(id: number): boolean {
    const changes = this.update(
      'scheduled_messages',
      { status: 'cancelled' },
      'id = ? AND status = ?',
      id,
      'pending'
    );
    return changes > 0;
  }

  /**
   * Delete a scheduled message
   */
  deleteScheduledMessage(id: number): boolean {
    const changes = this.delete('scheduled_messages', 'id = ?', id);
    return changes > 0;
  }

  /**
   * Get scheduled messages that are due to be sent
   */
  getDueScheduledMessages(): ScheduledMessage[] {
    const now = Date.now();
    const stmt = this.prepare(`
      SELECT id, chatId, sender, body, scheduledFor, status, createdAt, sentAt
      FROM scheduled_messages
      WHERE status = 'pending' AND scheduledFor <= ?
      ORDER BY scheduledFor ASC
    `);
    return stmt.all(now) as ScheduledMessage[];
  }

  /**
   * Mark a scheduled message as sent
   */
  markScheduledMessageSent(id: number, messageId: number): boolean {
    const changes = this.update(
      'scheduled_messages',
      { status: 'sent', sentAt: Date.now() },
      'id = ?',
      id
    );
    return changes > 0;
  }
}
