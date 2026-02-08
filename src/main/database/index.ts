// Database Connection
export { DatabaseConnection } from './DatabaseConnection';

// Base Repository
export { BaseRepository } from './BaseRepository';

// Repositories
export { MessageRepository } from './MessageRepository';
export type { Message, MessageReaction, ReadReceipt } from './MessageRepository';

export { ChatRepository } from './ChatRepository';
export type { Chat, ChatParticipant, MessageDraft } from './ChatRepository';

export { UserRepository } from './UserRepository';
export type { User, Session } from './UserRepository';

// Factory function to create all repositories with shared connection
import { DatabaseConnection } from './DatabaseConnection';
import { MessageRepository } from './MessageRepository';
import { ChatRepository } from './ChatRepository';
import { UserRepository } from './UserRepository';

export interface Repositories {
  messages: MessageRepository;
  chats: ChatRepository;
  users: UserRepository;
}

/**
 * Create all repositories with a shared database connection
 * @param dbPath Optional database path
 * @returns Object containing all repositories
 */
export function createRepositories(dbPath?: string): Repositories {
  const connection = DatabaseConnection.getInstance(dbPath);
  connection.initializeSchema();

  return {
    messages: new MessageRepository(connection),
    chats: new ChatRepository(connection),
    users: new UserRepository(connection)
  };
}
