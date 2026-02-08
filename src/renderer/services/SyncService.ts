/**
 * SyncService - Handles synchronization of missed messages after reconnection
 *
 * Features:
 * - Tracks last synced timestamp per chat
 * - Fetches missed messages on reconnection
 * - Batch syncing for multiple chats
 * - Persists sync state to localStorage
 */

import { store } from '../store';
import { addMessage } from '../store/messagesSlice';
import { Message } from '../types';

interface SyncState {
  lastSyncTime: number; // Global last sync time
  chatSyncTimes: Record<number, number>; // Per-chat last sync times
}

export class SyncService {
  private storageKey = 'sync_state';
  private syncState: SyncState = {
    lastSyncTime: Date.now(),
    chatSyncTimes: {},
  };
  private isSyncing = false;

  constructor() {
    this.loadState();
  }

  /**
   * Sync all missed messages since last connection
   */
  async syncMissedMessages(): Promise<void> {
    if (this.isSyncing) {
      console.log('[Sync] Already syncing, skipping...');
      return;
    }

    this.isSyncing = true;

    try {
      console.log('[Sync] Starting sync from', new Date(this.syncState.lastSyncTime));

      // Get active chats from Redux store
      const state = store.getState();
      const activeChats = state.chats.chats;

      // Sync each chat individually
      for (const chat of activeChats) {
        await this.syncChat(chat.id);
      }

      // Update global sync time
      this.syncState.lastSyncTime = Date.now();
      this.saveState();

      console.log('[Sync] Sync completed successfully');
    } catch (error) {
      console.error('[Sync] Failed to sync missed messages:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync messages for a specific chat
   */
  async syncChat(chatId: number): Promise<void> {
    try {
      // Get last sync time for this chat (or global if never synced)
      const lastSyncTime = this.syncState.chatSyncTimes[chatId] || this.syncState.lastSyncTime;

      console.log(`[Sync] Syncing chat ${chatId} from ${new Date(lastSyncTime)}`);

      // Fetch messages after last sync time
      const response = await window.electronAPI.getMessagesAfter(chatId, lastSyncTime, 100);

      if (response.success && response.data) {
        const missedMessages = response.data;

        if (missedMessages.length > 0) {
          console.log(`[Sync] Found ${missedMessages.length} missed messages in chat ${chatId}`);

          // Add messages to Redux store
          missedMessages.forEach((message: Message) => {
            store.dispatch(addMessage(message));
          });

          // Update chat sync time to latest message timestamp
          const latestTimestamp = Math.max(...missedMessages.map(m => m.ts));
          this.syncState.chatSyncTimes[chatId] = latestTimestamp;
          this.saveState();
        } else {
          console.log(`[Sync] No missed messages in chat ${chatId}`);
        }
      }
    } catch (error) {
      console.error(`[Sync] Failed to sync chat ${chatId}:`, error);
    }
  }

  /**
   * Update sync time for a chat when a message is received
   */
  updateChatSyncTime(chatId: number, timestamp: number): void {
    const currentTime = this.syncState.chatSyncTimes[chatId] || 0;
    if (timestamp > currentTime) {
      this.syncState.chatSyncTimes[chatId] = timestamp;
      this.saveState();
    }
  }

  /**
   * Reset sync state (useful for debugging or after logout)
   */
  reset(): void {
    this.syncState = {
      lastSyncTime: Date.now(),
      chatSyncTimes: {},
    };
    this.saveState();
  }

  /**
   * Get sync status
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Get last sync time for a chat
   */
  getLastSyncTime(chatId: number): number {
    return this.syncState.chatSyncTimes[chatId] || this.syncState.lastSyncTime;
  }

  // Private methods

  private loadState(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.syncState = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[Sync] Failed to load sync state:', error);
    }
  }

  private saveState(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.syncState));
    } catch (error) {
      console.error('[Sync] Failed to save sync state:', error);
    }
  }
}

export const syncService = new SyncService();
