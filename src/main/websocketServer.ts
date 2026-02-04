import { WebSocketServer, WebSocket } from 'ws';
import { DatabaseService } from './database';

export interface NewMessageEvent {
  type: 'NEW_MESSAGE';
  chatId: number;
  messageId: number;
  ts: number;
  sender: string;
  body: string;
}

export interface MessageEditedEvent {
  type: 'MESSAGE_EDITED';
  messageId: number;
  newBody: string;
  editedAt: number;
}

export interface MessageDeletedEvent {
  type: 'MESSAGE_DELETED';
  messageId: number;
}

export interface ReactionAddedEvent {
  type: 'REACTION_ADDED';
  messageId: number;
  chatId: number;
  userId: string;
  emoji: string;
}

export interface ReactionRemovedEvent {
  type: 'REACTION_REMOVED';
  messageId: number;
  userId: string;
  emoji: string;
}

export interface MessageReadEvent {
  type: 'MESSAGE_READ';
  messageId: number;
  userId: string;
  readAt: number;
}

export interface MessageDeliveredEvent {
  type: 'MESSAGE_DELIVERED';
  messageId: number;
  deliveredAt: number;
}

export interface PingEvent {
  type: 'PING';
}

export interface MessagePinnedEvent {
  type: 'MESSAGE_PINNED';
  messageId: number;
  chatId: number;
}

export interface MessageUnpinnedEvent {
  type: 'MESSAGE_UNPINNED';
  messageId: number;
  chatId: number;
}

export interface TypingStartEvent {
  type: 'TYPING_START';
  chatId: number;
  userId: string;
  userName: string;
}

export interface TypingStopEvent {
  type: 'TYPING_STOP';
  chatId: number;
  userId: string;
}

export interface PresenceChangedEvent {
  type: 'PRESENCE_CHANGED';
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
}

export interface MessageForwardedEvent {
  type: 'MESSAGE_FORWARDED';
  messageId: number;
  chatId: number;
  originalMessageId: number;
  ts: number;
  sender: string;
  body: string;
}

export interface GroupChatCreatedEvent {
  type: 'GROUP_CHAT_CREATED';
  chatId: number;
  title: string;
  createdBy: string;
  createdAt: number;
}

export interface ParticipantAddedEvent {
  type: 'PARTICIPANT_ADDED';
  chatId: number;
  userId: string;
  role: 'admin' | 'member';
  addedAt: number;
}

export interface ParticipantRemovedEvent {
  type: 'PARTICIPANT_REMOVED';
  chatId: number;
  userId: string;
  removedAt: number;
}

export interface ParticipantRoleChangedEvent {
  type: 'PARTICIPANT_ROLE_CHANGED';
  chatId: number;
  userId: string;
  newRole: 'admin' | 'member';
  changedAt: number;
}

// WebRTC Call Events

export interface CallInitiatedEvent {
  type: 'CALL_INITIATED';
  callId: string;
  chatId: number;
  callType: 'audio' | 'video';
  initiatedBy: string;
  timestamp: number;
}

export interface CallOfferEvent {
  type: 'CALL_OFFER';
  callId: string;
  fromUserId: string;
  offer: string; // JSON stringified RTCSessionDescriptionInit
}

export interface CallAnswerEvent {
  type: 'CALL_ANSWER';
  callId: string;
  fromUserId: string;
  answer: string; // JSON stringified RTCSessionDescriptionInit
}

export interface IceCandidateEvent {
  type: 'ICE_CANDIDATE';
  callId: string;
  fromUserId: string;
  candidate: string; // JSON stringified RTCIceCandidateInit
}

export interface CallEndedEvent {
  type: 'CALL_ENDED';
  callId: string;
  endedBy: string;
  timestamp: number;
}

export interface CallDeclinedEvent {
  type: 'CALL_DECLINED';
  callId: string;
  declinedBy: string;
  timestamp: number;
}

export interface ParticipantJoinedCallEvent {
  type: 'PARTICIPANT_JOINED_CALL';
  callId: string;
  userId: string;
  timestamp: number;
}

export interface ParticipantLeftCallEvent {
  type: 'PARTICIPANT_LEFT_CALL';
  callId: string;
  userId: string;
  timestamp: number;
}

export interface ScreenShareStartedEvent {
  type: 'SCREEN_SHARE_STARTED';
  callId: string;
  userId: string;
  timestamp: number;
}

export interface ScreenShareStoppedEvent {
  type: 'SCREEN_SHARE_STOPPED';
  callId: string;
  userId: string;
  timestamp: number;
}

export type ServerEvent =
  | NewMessageEvent
  | MessageEditedEvent
  | MessageDeletedEvent
  | ReactionAddedEvent
  | ReactionRemovedEvent
  | MessageReadEvent
  | MessageDeliveredEvent
  | MessagePinnedEvent
  | MessageUnpinnedEvent
  | TypingStartEvent
  | TypingStopEvent
  | PresenceChangedEvent
  | MessageForwardedEvent
  | GroupChatCreatedEvent
  | ParticipantAddedEvent
  | ParticipantRemovedEvent
  | ParticipantRoleChangedEvent
  | CallInitiatedEvent
  | CallOfferEvent
  | CallAnswerEvent
  | IceCandidateEvent
  | CallEndedEvent
  | CallDeclinedEvent
  | ParticipantJoinedCallEvent
  | ParticipantLeftCallEvent
  | ScreenShareStartedEvent
  | ScreenShareStoppedEvent
  | PingEvent;

interface ClientMetadata {
  ws: WebSocket;
  connectedAt: number;
  lastActivity: number;
  messageCount: number;
  userId?: string; 
}

export class MessengerWebSocketServer {
  private wss: WebSocketServer;
  private db: DatabaseService;
  private messageInterval?: NodeJS.Timeout;
  private pingInterval?: NodeJS.Timeout;
  private clients: Map<WebSocket, ClientMetadata> = new Map();

  // Rate limiting configuration
  private readonly MAX_MESSAGES_PER_MINUTE = 60;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute

  constructor(port: number, db: DatabaseService) {
    this.db = db;
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      console.log(`[WebSocket] Client ${clientId} connected`);

      // Initialize client metadata
      const metadata: ClientMetadata = {
        ws,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
      };
      this.clients.set(ws, metadata);

      ws.on('message', (data: Buffer) => {
        try {
          // Update last activity
          const client = this.clients.get(ws);
          if (client) {
            client.lastActivity = Date.now();
          }

          // Rate limiting check
          if (!this.checkRateLimit(ws)) {
            console.warn(`[WebSocket] Rate limit exceeded for client ${clientId}`);
            this.sendError(ws, 'Rate limit exceeded');
            return;
          }

          // Parse and validate message
          const message = JSON.parse(data.toString());

          // Handle message types
          if (message.type === 'PONG') {
            // Client responded to ping
          } else if (message.type === 'TYPING_START') {
            this.broadcastTypingStart(message.chatId, message.userId, message.userName);
          } else if (message.type === 'TYPING_STOP') {
            this.broadcastTypingStop(message.chatId, message.userId);
          }
        } catch (err) {
          console.error(`[WebSocket] Error processing message from ${clientId}:`, err);
          this.sendError(ws, 'Failed to process message');
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`[WebSocket] Client ${clientId} disconnected (code: ${code})`);
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error(`[WebSocket] Error from ${clientId}:`, error.message);
        this.clients.delete(ws);
      });
    });

    console.log(`WebSocket server started on port ${port}`);
  }

  start() {
    // Send new messages every 1-3 seconds
    this.messageInterval = setInterval(() => {
      this.sendRandomMessage();
    }, this.getRandomInterval(1000, 3000));

    // Send ping every 10 seconds
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 10000);

    console.log('WebSocket server message broadcasting started');
  }

  stop() {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    console.log('WebSocket server message broadcasting stopped');
  }

  close() {
    this.stop();
    this.clients.forEach((metadata, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1001, 'Server shutting down');
      }
    });
    this.clients.clear();
    this.wss.close();
    console.log('[WebSocket] Server closed gracefully');
  }

  // Helper methods for production-ready features

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private checkRateLimit(ws: WebSocket): boolean {
    const client = this.clients.get(ws);
    if (!client) return false;

    const now = Date.now();
    const timeWindow = now - this.RATE_LIMIT_WINDOW;

    // Reset counter if outside time window
    if (client.lastActivity < timeWindow) {
      client.messageCount = 0;
    }

    // Increment and check limit
    client.messageCount++;
    return client.messageCount <= this.MAX_MESSAGES_PER_MINUTE;
  }

  private sendError(ws: WebSocket, error: string): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          error,
          timestamp: Date.now(),
        }));
      }
    } catch (err) {
      console.error('[WebSocket] Failed to send error message:', err);
    }
  }

  private sendToClient(ws: WebSocket, data: any): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    } catch (err) {
      console.error('[WebSocket] Failed to send message to client:', err);
    }
  }

  private sendRandomMessage() {
    // Get all chats
    const chats = this.db.getChatList(200, 0);
    if (chats.length === 0) return;

    // Pick a random chat
    const randomChat = chats[Math.floor(Math.random() * chats.length)];

    // Create a new message
    const senders = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
    const messageTemplates = [
      'Hello!',
      'How are you doing?',
      'I have some news to share.',
      'Can you help me with something?',
      'Thanks for the update!',
      'Let me know when you are free.',
      'This is interesting.',
      'I agree with that.',
      'See you soon!',
      'Have a great day!'
    ];

    const sender = senders[Math.floor(Math.random() * senders.length)];
    const body = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
    const ts = Date.now();

    // Insert into database
    const messageId = this.db.createMessage(randomChat.id, ts, sender, body);

    // Broadcast to all connected clients
    const event: NewMessageEvent = {
      type: 'NEW_MESSAGE',
      chatId: randomChat.id,
      messageId,
      ts,
      sender,
      body
    };

    this.broadcast(event);
  }

  private sendPing() {
    const event: PingEvent = {
      type: 'PING'
    };
    this.broadcast(event);
  }

  private broadcast(event: ServerEvent) {
    const message = JSON.stringify(event);
    let successCount = 0;
    let failCount = 0;

    this.clients.forEach((metadata, ws) => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
          successCount++;
        }
      } catch (error) {
        console.error('[WebSocket] Failed to broadcast to client:', error);
        failCount++;
      }
    });

    if (failCount > 0) {
      console.warn(`[WebSocket] Broadcast completed: ${successCount} success, ${failCount} failed`);
    }
  }

  private getRandomInterval(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Broadcast a new message to all clients
  broadcastNewMessage(message: { id: number; chatId: number; ts: number; sender: string; body: string }) {
    const event: NewMessageEvent = {
      type: 'NEW_MESSAGE',
      chatId: message.chatId,
      messageId: message.id,
      ts: message.ts,
      sender: message.sender,
      body: message.body
    };
    this.broadcast(event);
  }

  // Broadcast an edited message to all clients
  broadcastMessageEdited(message: { id: number; body: string; editedAt?: number | null }) {
    const event: MessageEditedEvent = {
      type: 'MESSAGE_EDITED',
      messageId: message.id,
      newBody: message.body,
      editedAt: message.editedAt || Date.now()
    };
    this.broadcast(event);
  }

  // Broadcast a deleted message to all clients
  broadcastMessageDeleted(messageId: number) {
    const event: MessageDeletedEvent = {
      type: 'MESSAGE_DELETED',
      messageId
    };
    this.broadcast(event);
  }

  // Broadcast a reaction added to all clients
  broadcastReactionAdded(messageId: number, chatId: number, userId: string, emoji: string) {
    const event: ReactionAddedEvent = {
      type: 'REACTION_ADDED',
      messageId,
      chatId,
      userId,
      emoji
    };
    this.broadcast(event);
  }

  // Broadcast a reaction removed to all clients
  broadcastReactionRemoved(messageId: number, userId: string, emoji: string) {
    const event: ReactionRemovedEvent = {
      type: 'REACTION_REMOVED',
      messageId,
      userId,
      emoji
    };
    this.broadcast(event);
  }

  // Broadcast a message read receipt to all clients
  broadcastMessageRead(messageId: number, userId: string) {
    const event: MessageReadEvent = {
      type: 'MESSAGE_READ',
      messageId,
      userId,
      readAt: Date.now()
    };
    this.broadcast(event);
  }

  // Broadcast a message delivery confirmation to all clients
  broadcastMessageDelivered(messageId: number) {
    const event: MessageDeliveredEvent = {
      type: 'MESSAGE_DELIVERED',
      messageId,
      deliveredAt: Date.now()
    };
    this.broadcast(event);
  }

  // Broadcast a pinned message to all clients
  broadcastMessagePinned(messageId: number, chatId: number) {
    const event: MessagePinnedEvent = {
      type: 'MESSAGE_PINNED',
      messageId,
      chatId
    };
    this.broadcast(event);
  }

  // Broadcast an unpinned message to all clients
  broadcastMessageUnpinned(messageId: number, chatId: number) {
    const event: MessageUnpinnedEvent = {
      type: 'MESSAGE_UNPINNED',
      messageId,
      chatId
    };
    this.broadcast(event);
  }

  // Broadcast typing start to all clients
  broadcastTypingStart(chatId: number, userId: string, userName: string) {
    const event: TypingStartEvent = {
      type: 'TYPING_START',
      chatId,
      userId,
      userName
    };
    this.broadcast(event);
  }

  // Broadcast typing stop to all clients
  broadcastTypingStop(chatId: number, userId: string) {
    const event: TypingStopEvent = {
      type: 'TYPING_STOP',
      chatId,
      userId
    };
    this.broadcast(event);
  }

  // Broadcast presence change to all clients
  broadcastPresenceChanged(userId: string, status: 'online' | 'offline' | 'away', lastSeen: number) {
    const event: PresenceChangedEvent = {
      type: 'PRESENCE_CHANGED',
      userId,
      status,
      lastSeen
    };
    this.broadcast(event);
  }

  // Broadcast forwarded message to all clients
  broadcastMessageForwarded(message: { id: number; chatId: number; originalMessageId: number; ts: number; sender: string; body: string }) {
    const event: MessageForwardedEvent = {
      type: 'MESSAGE_FORWARDED',
      messageId: message.id,
      chatId: message.chatId,
      originalMessageId: message.originalMessageId,
      ts: message.ts,
      sender: message.sender,
      body: message.body
    };
    this.broadcast(event);
  }

  // Simulate connection drop
  disconnectAllClients() {
    console.log('[WebSocket] Simulating connection drop - closing all client connections');
    this.clients.forEach((metadata, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Use 1001 (Going Away) - 1006 is reserved and cannot be sent by applications
        ws.close(1001, 'Simulated connection drop');
      }
    });
  }

  // Broadcast group chat created to all clients
  broadcastGroupChatCreated(chatId: number, title: string, createdBy: string) {
    const event: GroupChatCreatedEvent = {
      type: 'GROUP_CHAT_CREATED',
      chatId,
      title,
      createdBy,
      createdAt: Date.now()
    };
    this.broadcast(event);
  }

  // Broadcast participant added to all clients
  broadcastParticipantAdded(chatId: number, userId: string, role: 'admin' | 'member') {
    const event: ParticipantAddedEvent = {
      type: 'PARTICIPANT_ADDED',
      chatId,
      userId,
      role,
      addedAt: Date.now()
    };
    this.broadcast(event);
  }

  // Broadcast participant removed to all clients
  broadcastParticipantRemoved(chatId: number, userId: string) {
    const event: ParticipantRemovedEvent = {
      type: 'PARTICIPANT_REMOVED',
      chatId,
      userId,
      removedAt: Date.now()
    };
    this.broadcast(event);
  }

  // Broadcast participant role changed to all clients
  broadcastParticipantRoleChanged(chatId: number, userId: string, newRole: 'admin' | 'member') {
    const event: ParticipantRoleChangedEvent = {
      type: 'PARTICIPANT_ROLE_CHANGED',
      chatId,
      userId,
      newRole,
      changedAt: Date.now()
    };
    this.broadcast(event);
  }

  // ===========================
  // WebRTC Call Broadcast Methods
  // ===========================

  broadcastCallInitiated(callId: string, chatId: number, callType: 'audio' | 'video', initiatedBy: string) {
    const event: CallInitiatedEvent = {
      type: 'CALL_INITIATED',
      callId,
      chatId,
      callType,
      initiatedBy,
      timestamp: Date.now()
    };
    this.broadcast(event);
  }

  broadcastCallOffer(callId: string, fromUserId: string, offer: string) {
    const event: CallOfferEvent = {
      type: 'CALL_OFFER',
      callId,
      fromUserId,
      offer
    };
    this.broadcast(event);
  }

  broadcastCallAnswer(callId: string, fromUserId: string, answer: string) {
    const event: CallAnswerEvent = {
      type: 'CALL_ANSWER',
      callId,
      fromUserId,
      answer
    };
    this.broadcast(event);
  }

  broadcastIceCandidate(callId: string, fromUserId: string, candidate: string) {
    const event: IceCandidateEvent = {
      type: 'ICE_CANDIDATE',
      callId,
      fromUserId,
      candidate
    };
    this.broadcast(event);
  }

  broadcastCallEnded(callId: string, endedBy: string) {
    const event: CallEndedEvent = {
      type: 'CALL_ENDED',
      callId,
      endedBy,
      timestamp: Date.now()
    };
    this.broadcast(event);
  }

  broadcastCallDeclined(callId: string, declinedBy: string) {
    const event: CallDeclinedEvent = {
      type: 'CALL_DECLINED',
      callId,
      declinedBy,
      timestamp: Date.now()
    };
    this.broadcast(event);
  }

  broadcastParticipantJoinedCall(callId: string, userId: string) {
    const event: ParticipantJoinedCallEvent = {
      type: 'PARTICIPANT_JOINED_CALL',
      callId,
      userId,
      timestamp: Date.now()
    };
    this.broadcast(event);
  }

  broadcastParticipantLeftCall(callId: string, userId: string) {
    const event: ParticipantLeftCallEvent = {
      type: 'PARTICIPANT_LEFT_CALL',
      callId,
      userId,
      timestamp: Date.now()
    };
    this.broadcast(event);
  }

  broadcastScreenShareStarted(callId: string, userId: string) {
    const event: ScreenShareStartedEvent = {
      type: 'SCREEN_SHARE_STARTED',
      callId,
      userId,
      timestamp: Date.now()
    };
    this.broadcast(event);
  }

  broadcastScreenShareStopped(callId: string, userId: string) {
    const event: ScreenShareStoppedEvent = {
      type: 'SCREEN_SHARE_STOPPED',
      callId,
      userId,
      timestamp: Date.now()
    };
    this.broadcast(event);
  }
}
