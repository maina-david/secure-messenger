import { store } from '../store';
import {
  setConnectionStatus,
  updateLastPing,
  incrementReconnectAttempts,
} from '../store/websocketSlice';
import { addMessage, editMessage, deleteMessage } from '../store/messagesSlice';
import { updateChatLastMessage } from '../store/chatsSlice';
import { Message } from '../types';
import { toast } from 'sonner';
import { messageQueueService, QueuedMessage } from './MessageQueueService';
import { syncService } from './SyncService';

interface NewMessageEvent {
  type: 'NEW_MESSAGE';
  chatId: number;
  messageId: number;
  ts: number;
  sender: string;
  body: string;
}

interface MessageEditedEvent {
  type: 'MESSAGE_EDITED';
  messageId: number;
  newBody: string;
  editedAt: number;
}

interface MessageDeletedEvent {
  type: 'MESSAGE_DELETED';
  messageId: number;
}

interface PingEvent {
  type: 'PING';
}

interface MessageAckEvent {
  type: 'MESSAGE_ACK';
  queueId: string; // Queue ID from client
  messageId: number; // Database ID from server
}

interface MessageNackEvent {
  type: 'MESSAGE_NACK';
  queueId: string;
  error: string;
}

type ServerEvent = NewMessageEvent | MessageEditedEvent | MessageDeletedEvent | PingEvent | MessageAckEvent | MessageNackEvent;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private port: number = 8080;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect: boolean = true;
  private maxReconnectDelay: number = 30000;
  private baseReconnectDelay: number = 1000;

  async initialize() {
    const response = await window.electronAPI.getWsPort();
    if (response.success && response.data) {
      this.port = response.data;
    }

    // Set up message queue callback
    messageQueueService.setOnSend(async (message) => {
      await this.sendQueuedMessage(message);
    });

    this.connect();
  }

  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    store.dispatch(setConnectionStatus('connecting'));

    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}`);

      this.ws.onopen = async () => {
        console.log('WebSocket connected');
        store.dispatch(setConnectionStatus('connected'));
        this.startHeartbeat();

        // Sync any missed messages while offline
        try {
          await syncService.syncMissedMessages();
        } catch (error) {
          console.error('[WebSocket] Failed to sync missed messages:', error);
        }

        // Process any pending messages in the queue
        messageQueueService.processQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: ServerEvent = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.stopHeartbeat();

        if (this.shouldReconnect) {
          store.dispatch(setConnectionStatus('reconnecting'));
          this.scheduleReconnect();
        } else {
          store.dispatch(setConnectionStatus('offline'));
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private handleMessage(event: ServerEvent) {
    switch (event.type) {
      case 'NEW_MESSAGE':
        this.handleNewMessage(event);
        break;
      case 'MESSAGE_EDITED':
        this.handleMessageEdited(event);
        break;
      case 'MESSAGE_DELETED':
        this.handleMessageDeleted(event);
        break;
      case 'PING':
        this.handlePing();
        break;
      case 'MESSAGE_ACK':
        this.handleMessageAck(event);
        break;
      case 'MESSAGE_NACK':
        this.handleMessageNack(event);
        break;
    }
  }

  private async handleNewMessage(event: NewMessageEvent) {
    let messageBody = event.body;

    try {
      const decryptResponse = await window.electronAPI.decryptMessage(event.body);
      if (decryptResponse.success && decryptResponse.data) {
        messageBody = decryptResponse.data;
      }
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      messageBody = '[Decryption failed]';
    }

    const message: Message = {
      id: event.messageId,
      chatId: event.chatId,
      ts: event.ts,
      sender: event.sender,
      body: messageBody,
    };

    store.dispatch(addMessage(message));
    store.dispatch(updateChatLastMessage({
      chatId: event.chatId,
      timestamp: event.ts,
    }));

    // Update sync time for this chat
    syncService.updateChatSyncTime(event.chatId, event.ts);
  }

  private async handleMessageEdited(event: MessageEditedEvent) {
    let newBody = event.newBody;

    try {
      const decryptResponse = await window.electronAPI.decryptMessage(event.newBody);
      if (decryptResponse.success && decryptResponse.data) {
        newBody = decryptResponse.data;
      }
    } catch (error) {
      console.error('Failed to decrypt edited message:', error);
      newBody = '[Decryption failed]';
    }

    store.dispatch(editMessage({
      messageId: event.messageId,
      newBody: newBody,
      editedAt: event.editedAt,
    }));
  }

  private handleMessageDeleted(event: MessageDeletedEvent) {
    store.dispatch(deleteMessage(event.messageId));
  }

  private handlePing() {
    store.dispatch(updateLastPing());
    // Send pong back
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'PONG' }));
    }
  }

  private handleMessageAck(event: MessageAckEvent) {
    messageQueueService.markAsSent(event.queueId);
    console.log(`Message ${event.queueId} acknowledged by server with ID ${event.messageId}`);
  }

  private handleMessageNack(event: MessageNackEvent) {
    messageQueueService.markAsFailed(event.queueId, event.error);
    console.error(`Message ${event.queueId} rejected by server: ${event.error}`);
    toast.error(`Failed to send message: ${event.error}`);
  }

  /**
   * Send a message through the queue system
   */
  sendMessage(chatId: number, sender: string, body: string): string {
    const queueId = messageQueueService.enqueue(chatId, sender, body);
    return queueId;
  }

  /**
   * Actually send a queued message over WebSocket
   */
  private async sendQueuedMessage(message: QueuedMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    // Send message with queue ID for ACK matching
    this.ws.send(JSON.stringify({
      type: 'SEND_MESSAGE',
      queueId: message.id,
      chatId: message.chatId,
      sender: message.sender,
      body: message.body,
      timestamp: message.timestamp,
    }));
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Check for missed pings every 5 seconds (improved from 15s)
    this.heartbeatTimeout = setInterval(() => {
      const state = store.getState();
      const lastPing = state.websocket.lastPingTime;
      const now = Date.now();

      // If no ping in 10 seconds, consider connection dead (improved from 30s)
      // This provides much faster detection of connection issues
      if (lastPing && now - lastPing > 10000) {
        console.warn('No ping received for 10 seconds, reconnecting...');
        this.reconnect();
      }
    }, 5000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimeout) {
      clearInterval(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const state = store.getState();
    const attempts = state.websocket.reconnectAttempts;

    // Exponential backoff with jitter: 1s, 2s, 4s, 8s, 16s, 30s (max)
    // Jitter prevents thundering herd problem where many clients reconnect simultaneously
    const baseDelay = Math.min(
      this.baseReconnectDelay * Math.pow(2, attempts),
      this.maxReconnectDelay
    );

    // Add random jitter: ±25% of base delay
    // For example, if baseDelay is 4000ms, jitter will be between 3000ms and 5000ms
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.max(1000, baseDelay + jitter); // Ensure minimum 1 second

    console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${attempts + 1}, base: ${baseDelay}ms)`);

    store.dispatch(incrementReconnectAttempts());

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  reconnect() {
    if (this.ws) {
      this.ws.close();
    }
    this.connect();
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
    store.dispatch(setConnectionStatus('offline'));
  }

  getConnectionStatus() {
    if (!this.ws) return 'offline';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'offline';
      default:
        return 'offline';
    }
  }
}

// Global instance
export const websocketService = new WebSocketService();
