import { Services } from './services';
import { MessengerWebSocketServer } from './websocketServer';

export class SchedulerService {
  private services: Services;
  private wsServer: MessengerWebSocketServer;
  private interval?: NodeJS.Timeout;
  private checkIntervalMs: number;

  constructor(services: Services, wsServer: MessengerWebSocketServer, checkIntervalMs: number = 10000) {
    this.services = services;
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
  private async processDueMessages() {
    try {
      const dueMessages = this.services.scheduledMessages.getDueScheduledMessages();

      if (dueMessages.length === 0) {
        return;
      }

      console.log(`Processing ${dueMessages.length} scheduled message(s)`);

      for (const scheduledMsg of dueMessages) {
        try {
          // Create the actual message using MessageService (automatically encrypts)
          const message = await this.services.messages.sendMessage({
            chatId: scheduledMsg.chatId,
            sender: scheduledMsg.sender,
            body: scheduledMsg.body,
            timestamp: Date.now()
          });

          // Mark scheduled message as sent
          this.services.scheduledMessages.markScheduledMessageSent(scheduledMsg.id, message.id);

          // Broadcast the new message to all clients
          if (this.wsServer) {
            this.wsServer.broadcastNewMessage({
              id: message.id,
              chatId: message.chatId,
              ts: message.ts,
              sender: message.sender,
              body: message.body
            });
          }

          console.log(`Sent scheduled message ${scheduledMsg.id} as message ${message.id}`);
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
