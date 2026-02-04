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

type ServerEvent = NewMessageEvent | MessageEditedEvent | MessageDeletedEvent | PingEvent;

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
    this.connect();
  }

  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    store.dispatch(setConnectionStatus('connecting'));

    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        store.dispatch(setConnectionStatus('connected'));
        this.startHeartbeat();
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

    const state = store.getState();
    const selectedChatId = state.messages.selectedChatId;
    const isFromCurrentUser = event.sender === 'You';

    if (!isFromCurrentUser && event.chatId !== selectedChatId) {
      const chat = state.chats.chats.find(c => c.id === event.chatId);
      const chatTitle = chat?.title || 'Unknown';

      toast.message(`${event.sender}`, {
        description: messageBody,
        duration: 4000,
      });
    }
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

  private startHeartbeat() {
    this.stopHeartbeat();
    // Check for missed pings every 15 seconds
    this.heartbeatTimeout = setInterval(() => {
      const state = store.getState();
      const lastPing = state.websocket.lastPingTime;
      const now = Date.now();

      // If no ping in 30 seconds, consider connection dead
      if (lastPing && now - lastPing > 30000) {
        console.warn('No ping received for 30 seconds, reconnecting...');
        this.reconnect();
      }
    }, 15000);
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

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, attempts),
      this.maxReconnectDelay
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${attempts + 1})`);

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
