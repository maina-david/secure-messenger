import { DatabaseService } from './database';
import { MessengerWebSocketServer } from './websocketServer';

export class SchedulerService {
  private db: DatabaseService;
  private wsServer: MessengerWebSocketServer;
  private interval?: NodeJS.Timeout;
  private checkIntervalMs: number;

  constructor(db: DatabaseService, wsServer: MessengerWebSocketServer, checkIntervalMs: number = 10000) {
    this.db = db;
    this.wsServer = wsServer;
    this.checkIntervalMs = checkIntervalMs;
  }

  /**
   * Start the scheduler - checks for due messages at regular intervals
   */
  start() {
    console.log('Scheduler service started');
    this.interval = setInterval(() => {
      this.processDueMessages();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
      console.log('Scheduler service stopped');
    }
  }

  /**
   * Process all messages that are due to be sent
   */
  private processDueMessages() {
    try {
      const dueMessages = this.db.getDueScheduledMessages();

      if (dueMessages.length === 0) {
        return;
      }

      console.log(`Processing ${dueMessages.length} scheduled message(s)`);

      for (const scheduledMsg of dueMessages) {
        try {
          // Create the actual message
          const messageId = this.db.createMessage(
            scheduledMsg.chatId,
            Date.now(),
            scheduledMsg.sender,
            scheduledMsg.body
          );

          // Mark scheduled message as sent
          this.db.markScheduledMessageSent(scheduledMsg.id, messageId);

          // Broadcast the new message to all clients
          const message = this.db.getMessageById(messageId);
          if (message && this.wsServer) {
            this.wsServer.broadcastNewMessage({
              id: message.id,
              chatId: message.chatId,
              ts: message.ts,
              sender: message.sender,
              body: message.body
            });
          }

          console.log(`Sent scheduled message ${scheduledMsg.id} as message ${messageId}`);
        } catch (error) {
          console.error(`Error sending scheduled message ${scheduledMsg.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing scheduled messages:', error);
    }
  }

  /**
   * Manually trigger processing of due messages (useful for testing)
   */
  triggerCheck() {
    this.processDueMessages();
  }
}
