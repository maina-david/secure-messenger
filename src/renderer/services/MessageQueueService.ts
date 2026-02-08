/**
 * MessageQueueService - Handles outgoing message queueing with retry logic
 *
 * Features:
 * - Persists pending messages to localStorage
 * - Automatic retry on connection restore
 * - Exponential backoff for failed sends
 * - Maximum retry attempts before marking as failed
 * - ACK/NACK system for delivery confirmation
 */

export interface QueuedMessage {
  id: string; // Unique queue ID (UUID)
  chatId: number;
  sender: string;
  body: string;
  timestamp: number;
  attemptCount: number;
  nextRetryAt: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
}

interface MessageQueueOptions {
  maxRetries: number;
  baseRetryDelay: number;
  maxRetryDelay: number;
  storageKey: string;
}

export class MessageQueueService {
  private queue: Map<string, QueuedMessage> = new Map();
  private options: MessageQueueOptions = {
    maxRetries: 5,
    baseRetryDelay: 1000, // 1 second
    maxRetryDelay: 60000, // 60 seconds
    storageKey: 'message_queue',
  };
  private retryTimer: NodeJS.Timeout | null = null;
  private onSendCallback: ((message: QueuedMessage) => Promise<void>) | null = null;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Register a callback for sending messages
   */
  setOnSend(callback: (message: QueuedMessage) => Promise<void>) {
    this.onSendCallback = callback;
  }

  /**
   * Add a message to the queue
   */
  enqueue(chatId: number, sender: string, body: string): string {
    const id = this.generateId();
    const message: QueuedMessage = {
      id,
      chatId,
      sender,
      body,
      timestamp: Date.now(),
      attemptCount: 0,
      nextRetryAt: Date.now(),
      status: 'pending',
    };

    this.queue.set(id, message);
    this.saveToStorage();

    // Try to send immediately if connected
    this.processQueue();

    return id;
  }

  /**
   * Mark a message as successfully sent
   */
  markAsSent(id: string) {
    const message = this.queue.get(id);
    if (message) {
      message.status = 'sent';
      this.queue.delete(id); // Remove from queue once sent
      this.saveToStorage();
    }
  }

  /**
   * Mark a message as failed
   */
  markAsFailed(id: string, error: string) {
    const message = this.queue.get(id);
    if (message) {
      message.status = 'failed';
      message.error = error;
      message.attemptCount++;

      // Calculate next retry time with exponential backoff
      const delay = Math.min(
        this.options.baseRetryDelay * Math.pow(2, message.attemptCount),
        this.options.maxRetryDelay
      );
      message.nextRetryAt = Date.now() + delay;

      // If max retries reached, mark as permanently failed
      if (message.attemptCount >= this.options.maxRetries) {
        console.error(`Message ${id} failed after ${message.attemptCount} attempts`);
        this.queue.delete(id); // Remove from queue
      }

      this.saveToStorage();
      this.scheduleRetry();
    }
  }

  /**
   * Process all pending messages in the queue
   */
  async processQueue() {
    if (!this.onSendCallback) {
      console.warn('No send callback registered');
      return;
    }

    const now = Date.now();
    const pendingMessages = Array.from(this.queue.values())
      .filter(msg =>
        (msg.status === 'pending' || msg.status === 'failed') &&
        msg.nextRetryAt <= now
      )
      .sort((a, b) => a.timestamp - b.timestamp); // Send in chronological order

    for (const message of pendingMessages) {
      if (message.status === 'sending') continue; // Skip if already sending

      message.status = 'sending';
      this.saveToStorage();

      try {
        await this.onSendCallback(message);
        this.markAsSent(message.id);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.markAsFailed(message.id, errorMsg);
      }
    }
  }

  /**
   * Get all messages in queue
   */
  getAllMessages(): QueuedMessage[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get pending message count
   */
  getPendingCount(): number {
    return Array.from(this.queue.values()).filter(
      msg => msg.status === 'pending' || msg.status === 'failed'
    ).length;
  }

  /**
   * Clear all messages from queue
   */
  clear() {
    this.queue.clear();
    this.saveToStorage();
  }

  /**
   * Remove a specific message from queue
   */
  remove(id: string) {
    this.queue.delete(id);
    this.saveToStorage();
  }

  /**
   * Retry all failed messages immediately
   */
  retryAll() {
    const now = Date.now();
    Array.from(this.queue.values()).forEach(msg => {
      if (msg.status === 'failed') {
        msg.status = 'pending';
        msg.nextRetryAt = now;
      }
    });
    this.saveToStorage();
    this.processQueue();
  }

  // Private methods

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.options.storageKey);
      if (stored) {
        const messages: QueuedMessage[] = JSON.parse(stored);
        messages.forEach(msg => {
          // Reset sending status to pending on load
          if (msg.status === 'sending') {
            msg.status = 'pending';
          }
          this.queue.set(msg.id, msg);
        });
      }
    } catch (error) {
      console.error('Failed to load message queue from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      const messages = Array.from(this.queue.values());
      localStorage.setItem(this.options.storageKey, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save message queue to storage:', error);
    }
  }

  private scheduleRetry() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    // Find the next message that needs retry
    const now = Date.now();
    const nextRetry = Array.from(this.queue.values())
      .filter(msg => msg.status === 'failed' && msg.nextRetryAt > now)
      .sort((a, b) => a.nextRetryAt - b.nextRetryAt)[0];

    if (nextRetry) {
      const delay = nextRetry.nextRetryAt - now;
      this.retryTimer = setTimeout(() => {
        this.processQueue();
      }, delay);
    }
  }
}

export const messageQueueService = new MessageQueueService();
