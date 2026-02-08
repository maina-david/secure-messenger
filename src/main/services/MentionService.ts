import { BaseService } from './BaseService';
import { MentionRepository, Mention } from '../database/MentionRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';

export class MentionService extends BaseService {
  private mentionRepo: MentionRepository;

  constructor(dbConnection?: DatabaseConnection) {
    super(dbConnection);
    this.mentionRepo = new MentionRepository(dbConnection);
  }

  /**
   * Add a mention to a message
   */
  addMention(messageId: number, mentionedUserId: string): number {
    return this.mentionRepo.addMention(messageId, mentionedUserId);
  }

  /**
   * Get all mentions for a message
   */
  getMentionsByMessage(messageId: number): Mention[] {
    return this.mentionRepo.getMentionsByMessage(messageId);
  }

  /**
   * Get messages where a user was mentioned
   */
  getMentionsByUser(userId: string, limit: number = 50): Mention[] {
    return this.mentionRepo.getMentionsByUser(userId, limit);
  }

  /**
   * Delete mentions for a message
   */
  deleteMentionsByMessage(messageId: number): boolean {
    return this.mentionRepo.deleteMentionsByMessage(messageId);
  }

  /**
   * Parse message body and extract mentioned user IDs
   */
  parseMentions(body: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(body)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }
}
