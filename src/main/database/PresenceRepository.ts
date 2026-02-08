import { BaseRepository } from './BaseRepository';

export interface UserPresence {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
  updatedAt: number;
}

export class PresenceRepository extends BaseRepository {
  /**
   * Update user presence status
   */
  updatePresence(userId: string, status: 'online' | 'offline' | 'away'): void {
    const now = Date.now();
    const stmt = this.prepare(`
      INSERT INTO user_presence (userId, status, lastSeen, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET status = ?, lastSeen = ?, updatedAt = ?
    `);
    stmt.run(userId, status, now, now, status, now, now);
  }

  /**
   * Get user presence status
   */
  getUserPresence(userId: string): UserPresence | null {
    const stmt = this.prepare(`
      SELECT userId, status, lastSeen, updatedAt
      FROM user_presence
      WHERE userId = ?
    `);
    const result = stmt.get(userId) as UserPresence | undefined;
    return result || null;
  }

  /**
   * Get all user presence statuses
   */
  getAllPresence(): UserPresence[] {
    const stmt = this.prepare(`
      SELECT userId, status, lastSeen, updatedAt
      FROM user_presence
      ORDER BY updatedAt DESC
    `);
    return stmt.all() as UserPresence[];
  }
}
