import { BaseService } from './BaseService';
import { SettingsRepository, UserSetting, KeyboardShortcut } from '../database/SettingsRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';

export class SettingsService extends BaseService {
  private settingsRepo: SettingsRepository;

  constructor(dbConnection?: DatabaseConnection) {
    super(dbConnection);
    this.settingsRepo = new SettingsRepository(dbConnection);
  }

  /**
   * Get a user setting by key
   */
  getUserSetting(key: string): UserSetting | null {
    return this.settingsRepo.getUserSetting(key);
  }

  /**
   * Set a user setting
   */
  setUserSetting(key: string, value: string): void {
    if (!key || key.trim().length === 0) {
      throw new Error('Setting key cannot be empty');
    }
    this.settingsRepo.setUserSetting(key, value);
  }

  /**
   * Delete a user setting
   */
  deleteUserSetting(key: string): boolean {
    return this.settingsRepo.deleteUserSetting(key);
  }

  /**
   * Get all user settings
   */
  getAllSettings(): UserSetting[] {
    return this.settingsRepo.getAllSettings();
  }

  /**
   * Get keyboard shortcuts
   */
  getKeyboardShortcuts(): KeyboardShortcut[] {
    return this.settingsRepo.getKeyboardShortcuts();
  }

  /**
   * Set keyboard shortcuts
   */
  setKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
    this.validateRequired({ shortcuts }, ['shortcuts']);
    this.settingsRepo.setKeyboardShortcuts(shortcuts);
  }

  /**
   * Reset keyboard shortcuts to defaults
   */
  resetKeyboardShortcuts(): KeyboardShortcut[] {
    return this.settingsRepo.resetKeyboardShortcuts();
  }

  /**
   * Get notification sound for a chat or default
   */
  getNotificationSound(chatId?: number): string | null {
    return this.settingsRepo.getNotificationSound(chatId);
  }

  /**
   * Set notification sound for a chat or default
   */
  setNotificationSound(chatId: number | null, soundId: string): void {
    if (!soundId || soundId.trim().length === 0) {
      throw new Error('Sound ID cannot be empty');
    }
    this.settingsRepo.setNotificationSound(chatId, soundId);
  }

  /**
   * Delete notification sound setting
   */
  deleteNotificationSound(chatId?: number): boolean {
    return this.settingsRepo.deleteNotificationSound(chatId);
  }
}
