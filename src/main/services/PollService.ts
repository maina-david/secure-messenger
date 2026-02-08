import { BaseService } from './BaseService';
import { PollRepository, Poll, PollOption, PollResult } from '../database/PollRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';

export class PollService extends BaseService {
  private pollRepo: PollRepository;

  constructor(dbConnection?: DatabaseConnection) {
    super(dbConnection);
    this.pollRepo = new PollRepository(dbConnection);
  }

  /**
   * Create a poll
   */
  createPoll(
    messageId: number,
    question: string,
    options: string[],
    allowMultiple: boolean = false,
    expiresAt?: number
  ): number | null {
    this.validateRequired({ messageId, question, options }, ['messageId', 'question', 'options']);

    if (options.length < 2) {
      throw new Error('Poll must have at least 2 options');
    }

    if (question.trim().length === 0) {
      throw new Error('Poll question cannot be empty');
    }

    return this.pollRepo.createPoll(messageId, question, options, allowMultiple, expiresAt);
  }

  /**
   * Get a poll by ID
   */
  getPoll(pollId: number): Poll | null {
    return this.pollRepo.getPoll(pollId) || null;
  }

  /**
   * Get a poll by message ID
   */
  getPollByMessage(messageId: number): Poll | null {
    return this.pollRepo.getPollByMessage(messageId) || null;
  }

  /**
   * Get poll options
   */
  getPollOptions(pollId: number): PollOption[] {
    return this.pollRepo.getPollOptions(pollId);
  }

  /**
   * Vote on a poll
   */
  votePoll(pollId: number, optionId: number, userId: string): boolean {
    return this.pollRepo.votePoll(pollId, optionId, userId);
  }

  /**
   * Remove a poll vote
   */
  removePollVote(pollId: number, optionId: number, userId: string): boolean {
    return this.pollRepo.removePollVote(pollId, optionId, userId);
  }

  /**
   * Get poll results
   */
  getPollResults(pollId: number): Record<number, PollResult> {
    return this.pollRepo.getPollResults(pollId);
  }

  /**
   * Get user's votes for a poll
   */
  getUserPollVotes(pollId: number, userId: string): number[] {
    return this.pollRepo.getUserPollVotes(pollId, userId);
  }
}
