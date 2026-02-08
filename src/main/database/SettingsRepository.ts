import { BaseRepository } from './BaseRepository';

export interface UserSetting {
  key: string;
  value: string;
  updatedAt: number;
}

export interface KeyboardShortcut {
  action: string;
  key: string;
  modifiers: string[];
  description: string;
}

export class SettingsRepository extends BaseRepository {
  /**
   * Get a user setting by key
   */
  getUserSetting(key: string): UserSetting | null {
    const stmt = this.prepare('SELECT * FROM user_settings WHERE key = ?');
    return (stmt.get(key) as UserSetting | undefined) || null;
  }

  /**
   * Set a user setting
   */
  setUserSetting(key: string, value: string): void {
    const now = Date.now();
    const stmt = this.prepare(`
      INSERT INTO user_settings (key, value, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = ?,
        updatedAt = ?
    `);
    stmt.run(key, value, now, value, now);
  }

  /**
   * Delete a user setting
   */
  deleteUserSetting(key: string): boolean {
    const changes = this.delete('user_settings', 'key = ?', key);
    return changes > 0;
  }

  /**
   * Get all user settings
   */
  getAllSettings(): UserSetting[] {
    const stmt = this.prepare('SELECT * FROM user_settings ORDER BY key');
    return stmt.all() as UserSetting[];
  }

  /**
   * Get keyboard shortcuts from settings
   */
  getKeyboardShortcuts(): KeyboardShortcut[] {
    const setting = this.getUserSetting('keyboard_shortcuts');
    if (setting) {
      try {
        return JSON.parse(setting.value) as KeyboardShortcut[];
      } catch (error) {
        console.error('[SettingsRepository] Failed to parse keyboard shortcuts:', error);
        return this.getDefaultKeyboardShortcuts();
      }
    }
    return this.getDefaultKeyboardShortcuts();
  }

  /**
   * Set keyboard shortcuts
   */
  setKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
    const value = JSON.stringify(shortcuts);
    this.setUserSetting('keyboard_shortcuts', value);
  }

  /**
   * Reset keyboard shortcuts to defaults
   */
  resetKeyboardShortcuts(): KeyboardShortcut[] {
    const defaults = this.getDefaultKeyboardShortcuts();
    this.setKeyboardShortcuts(defaults);
    return defaults;
  }

  /**
   * Get notification sound setting
   */
  getNotificationSound(chatId?: number): string | null {
    const key = chatId ? `notification_sound_${chatId}` : 'notification_sound_default';
    const setting = this.getUserSetting(key);
    return setting?.value || null;
  }

  /**
   * Set notification sound
   */
  setNotificationSound(chatId: number | null, soundId: string): void {
    const key = chatId ? `notification_sound_${chatId}` : 'notification_sound_default';
    this.setUserSetting(key, soundId);
  }

  /**
   * Delete notification sound setting
   */
  deleteNotificationSound(chatId?: number): boolean {
    const key = chatId ? `notification_sound_${chatId}` : 'notification_sound_default';
    return this.deleteUserSetting(key);
  }

  /**
   * Get default keyboard shortcuts
   */
  private getDefaultKeyboardShortcuts(): KeyboardShortcut[] {
    return [
      { action: 'send-message', key: 'Enter', modifiers: [], description: 'Send message' },
      { action: 'new-line', key: 'Enter', modifiers: ['Shift'], description: 'New line in message' },
      { action: 'search', key: 'k', modifiers: ['Ctrl'], description: 'Search messages' },
      { action: 'search', key: 'k', modifiers: ['Meta'], description: 'Search messages (Mac)' },
      { action: 'toggle-search', key: 'f', modifiers: ['Ctrl'], description: 'Toggle search panel' },
      { action: 'toggle-search', key: 'f', modifiers: ['Meta'], description: 'Toggle search panel (Mac)' },
      { action: 'edit-last-message', key: 'ArrowUp', modifiers: [], description: 'Edit last message (when input empty)' },
      { action: 'cancel', key: 'Escape', modifiers: [], description: 'Cancel reply/edit/search' },
      { action: 'pin-message', key: 'p', modifiers: ['Ctrl'], description: 'Pin selected message' },
      { action: 'pin-message', key: 'p', modifiers: ['Meta'], description: 'Pin selected message (Mac)' },
      { action: 'export-chat', key: 'e', modifiers: ['Ctrl', 'Shift'], description: 'Export current chat' },
      { action: 'export-chat', key: 'e', modifiers: ['Meta', 'Shift'], description: 'Export current chat (Mac)' },
      { action: 'navigate-up', key: 'ArrowUp', modifiers: ['Alt'], description: 'Navigate to previous message' },
      { action: 'navigate-down', key: 'ArrowDown', modifiers: ['Alt'], description: 'Navigate to next message' },
      { action: 'reply', key: 'r', modifiers: ['Ctrl'], description: 'Reply to selected message' },
      { action: 'reply', key: 'r', modifiers: ['Meta'], description: 'Reply to selected message (Mac)' },
      { action: 'delete-message', key: 'Delete', modifiers: ['Ctrl'], description: 'Delete selected message' },
      { action: 'delete-message', key: 'Backspace', modifiers: ['Meta'], description: 'Delete selected message (Mac)' },
      { action: 'show-shortcuts', key: '/', modifiers: ['Ctrl'], description: 'Show keyboard shortcuts' },
      { action: 'show-shortcuts', key: '/', modifiers: ['Meta'], description: 'Show keyboard shortcuts (Mac)' }
    ];
  }
}
