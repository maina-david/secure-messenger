import { BaseService } from './BaseService';
import { PresenceRepository, UserPresence } from '../database/PresenceRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';

export class PresenceService extends BaseService {
  private presenceRepo: PresenceRepository;

  constructor(dbConnection?: DatabaseConnection) {
    super(dbConnection);
    this.presenceRepo = new PresenceRepository(dbConnection);
  }

  /**
   * Update user presence status
   */
  updatePresence(userId: string, status: 'online' | 'offline' | 'away'): void {
    this.presenceRepo.updatePresence(userId, status);
  }

  /**
   * Get user presence status
   */
  getUserPresence(userId: string): UserPresence | null {
    return this.presenceRepo.getUserPresence(userId);
  }

  /**
   * Get all user presence statuses
   */
  getAllPresence(): UserPresence[] {
    return this.presenceRepo.getAllPresence();
  }
}
