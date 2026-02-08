import { BaseRepository } from './BaseRepository';

export interface Mention {
  id: number;
  messageId: number;
  mentionedUserId: string;
}

export class MentionRepository extends BaseRepository {
  /**
   * Add a mention to a message
   */
  addMention(messageId: number, mentionedUserId: string): number {
    return this.insert('message_mentions', {
      messageId,
      mentionedUserId
    });
  }

  /**
   * Get all mentions for a message
   */
  getMentionsByMessage(messageId: number): Mention[] {
    const stmt = this.prepare(`
      SELECT id, messageId, mentionedUserId
      FROM message_mentions
      WHERE messageId = ?
    `);
    return stmt.all(messageId) as Mention[];
  }

  /**
   * Get messages where a user was mentioned
   */
  getMentionsByUser(userId: string, limit: number = 50): Mention[] {
    const stmt = this.prepare(`
      SELECT id, messageId, mentionedUserId
      FROM message_mentions
      WHERE mentionedUserId = ?
      ORDER BY id DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as Mention[];
  }

  /**
   * Delete mentions for a message
   */
  deleteMentionsByMessage(messageId: number): boolean {
    const changes = this.delete('message_mentions', 'messageId = ?', messageId);
    return changes > 0;
  }
}
