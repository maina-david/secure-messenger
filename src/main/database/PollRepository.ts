import { BaseRepository } from './BaseRepository';

export interface Poll {
  id: number;
  messageId: number;
  question: string;
  allowMultiple: number;
  expiresAt?: number | null;
  createdAt: number;
}

export interface PollOption {
  id: number;
  pollId: number;
  optionText: string;
  optionIndex: number;
}

export interface PollVote {
  id: number;
  pollId: number;
  optionId: number;
  userId: string;
  votedAt: number;
}

export interface PollResult {
  optionId: number;
  optionText: string;
  count: number;
  voters: string[];
}

export class PollRepository extends BaseRepository {
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
    try {
      return this.transaction(() => {
        // Create the poll
        const pollId = this.insert('polls', {
          messageId,
          question,
          allowMultiple: allowMultiple ? 1 : 0,
          expiresAt: expiresAt || null,
          createdAt: Date.now()
        });

        // Create poll options
        for (let i = 0; i < options.length; i++) {
          this.insert('poll_options', {
            pollId,
            optionText: options[i],
            optionIndex: i
          });
        }

        return pollId;
      });
    } catch (error) {
      console.error('[PollRepository] Error creating poll:', error);
      return null;
    }
  }

  /**
   * Get a poll by ID
   */
  getPoll(pollId: number): Poll | undefined {
    const stmt = this.prepare(`
      SELECT id, messageId, question, allowMultiple, expiresAt, createdAt
      FROM polls
      WHERE id = ?
    `);
    return stmt.get(pollId) as Poll | undefined;
  }

  /**
   * Get a poll by message ID
   */
  getPollByMessage(messageId: number): Poll | undefined {
    const stmt = this.prepare(`
      SELECT id, messageId, question, allowMultiple, expiresAt, createdAt
      FROM polls
      WHERE messageId = ?
    `);
    return stmt.get(messageId) as Poll | undefined;
  }

  /**
   * Get poll options
   */
  getPollOptions(pollId: number): PollOption[] {
    const stmt = this.prepare(`
      SELECT id, pollId, optionText, optionIndex
      FROM poll_options
      WHERE pollId = ?
      ORDER BY optionIndex ASC
    `);
    return stmt.all(pollId) as PollOption[];
  }

  /**
   * Vote on a poll
   */
  votePoll(pollId: number, optionId: number, userId: string): boolean {
    try {
      return this.transaction(() => {
        const poll = this.getPoll(pollId);
        if (!poll) return false;

        // Check if poll has expired
        if (poll.expiresAt && poll.expiresAt < Date.now()) {
          return false;
        }

        // If single choice, remove any existing votes from this user
        if (!poll.allowMultiple) {
          this.delete('poll_votes', 'pollId = ? AND userId = ?', pollId, userId);
        }

        // Add the vote
        this.insert('poll_votes', {
          pollId,
          optionId,
          userId,
          votedAt: Date.now()
        });

        return true;
      });
    } catch (error) {
      console.error('[PollRepository] Error voting on poll:', error);
      return false;
    }
  }

  /**
   * Remove a poll vote
   */
  removePollVote(pollId: number, optionId: number, userId: string): boolean {
    const changes = this.delete(
      'poll_votes',
      'pollId = ? AND optionId = ? AND userId = ?',
      pollId,
      optionId,
      userId
    );
    return changes > 0;
  }

  /**
   * Get poll results
   */
  getPollResults(pollId: number): Record<number, PollResult> {
    const options = this.getPollOptions(pollId);
    const votes = this.getPollVotes(pollId);

    const results: Record<number, PollResult> = {};

    // Initialize results
    for (const option of options) {
      results[option.id] = {
        optionId: option.id,
        optionText: option.optionText,
        count: 0,
        voters: []
      };
    }

    // Count votes
    for (const vote of votes) {
      if (results[vote.optionId]) {
        results[vote.optionId].count++;
        results[vote.optionId].voters.push(vote.userId);
      }
    }

    return results;
  }

  /**
   * Get user's votes for a poll
   */
  getUserPollVotes(pollId: number, userId: string): number[] {
    const stmt = this.prepare(`
      SELECT optionId
      FROM poll_votes
      WHERE pollId = ? AND userId = ?
    `);
    const results = stmt.all(pollId, userId) as Array<{ optionId: number }>;
    return results.map(r => r.optionId);
  }

  /**
   * Get all votes for a poll
   */
  private getPollVotes(pollId: number): PollVote[] {
    const stmt = this.prepare(`
      SELECT id, pollId, optionId, userId, votedAt
      FROM poll_votes
      WHERE pollId = ?
      ORDER BY votedAt ASC
    `);
    return stmt.all(pollId) as PollVote[];
  }
}
