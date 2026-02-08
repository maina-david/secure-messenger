// Base Service
export { BaseService } from './BaseService';

// Security Services
export { SecurityService, securityService } from './SecurityService';
export { KeyManagementService, keyManagementService } from './KeyManagementService';
export { ChatKeyService, chatKeyService } from './ChatKeyService';
export type { ChatKeys } from './ChatKeyService';

// Rate Limiting
export { RateLimitService, rateLimitService } from './RateLimitService';
export type { RateLimitOptions } from './RateLimitService';

// Business Logic Services
export { MessageService } from './MessageService';
export type { SendMessageOptions, DecryptedMessage } from './MessageService';

export { ChatService } from './ChatService';
export type { CreateChatOptions } from './ChatService';

export { AuthService } from './AuthService';
export type { SignupOptions, LoginResult } from './AuthService';

export { PresenceService } from './PresenceService';
export { MentionService } from './MentionService';
export { SettingsService } from './SettingsService';
export { MediaService } from './MediaService';
export { PollService } from './PollService';
export { ScheduledMessageService } from './ScheduledMessageService';
export { CallService } from './CallService';
export { ContactService } from './ContactService';

// Service Factory
import { DatabaseConnection } from '../database/DatabaseConnection';
import { MessageService } from './MessageService';
import { ChatService } from './ChatService';
import { AuthService } from './AuthService';
import { PresenceService } from './PresenceService';
import { MentionService } from './MentionService';
import { SettingsService } from './SettingsService';
import { MediaService } from './MediaService';
import { PollService } from './PollService';
import { ScheduledMessageService } from './ScheduledMessageService';
import { CallService } from './CallService';
import { ContactService } from './ContactService';

export interface Services {
  messages: MessageService;
  chats: ChatService;
  auth: AuthService;
  presence: PresenceService;
  mentions: MentionService;
  settings: SettingsService;
  media: MediaService;
  polls: PollService;
  scheduledMessages: ScheduledMessageService;
  calls: CallService;
  contacts: ContactService;
}

/**
 * Create all services with a shared database connection
 * @param dbPath Optional database path
 * @returns Object containing all services
 */
export function createServices(dbPath?: string): Services {
  const connection = DatabaseConnection.getInstance(dbPath);

  return {
    messages: new MessageService(connection),
    chats: new ChatService(connection),
    auth: new AuthService(connection),
    presence: new PresenceService(connection),
    mentions: new MentionService(connection),
    settings: new SettingsService(connection),
    media: new MediaService(connection),
    polls: new PollService(connection),
    scheduledMessages: new ScheduledMessageService(connection),
    calls: new CallService(connection),
    contacts: new ContactService(connection)
  };
}
