import { DatabaseService, Chat, Message } from './database';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Mock electron app
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => __dirname),
  },
}));

// Skip these tests in Jest environment (Node.js) as better-sqlite3 is compiled for Electron
// These tests would pass in an Electron environment
describe.skip('DatabaseService', () => {
  let db: DatabaseService;
  let testDbPath: string;

  beforeEach(() => {
    // Create a temporary test database
    testDbPath = path.join(__dirname, `test-${Date.now()}.db`);
    db = new DatabaseService(testDbPath);
  });

  afterEach(() => {
    // Clean up
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Chat Operations', () => {
    it('should create a new chat', () => {
      const chatId = db.createChat('Test Chat', Date.now());
      expect(chatId).toBeGreaterThan(0);
    });

    it('should get chat by id', () => {
      const timestamp = Date.now();
      const chatId = db.createChat('Test Chat', timestamp);
      const chat = db.getChatById(chatId);

      expect(chat).toBeDefined();
      expect(chat?.title).toBe('Test Chat');
      expect(chat?.lastMessageAt).toBe(timestamp);
      expect(chat?.unreadCount).toBe(0);
    });

    it('should get chat list with pagination', () => {
      // Create 5 chats
      for (let i = 1; i <= 5; i++) {
        db.createChat(`Chat ${i}`, Date.now() + i);
      }

      const chats = db.getChatList(3, 0);
      expect(chats).toHaveLength(3);

      // Should be ordered by lastMessageAt DESC
      expect(chats[0].lastMessageAt).toBeGreaterThan(chats[1].lastMessageAt);
    });

    it('should update chat last message timestamp', () => {
      const chatId = db.createChat('Test Chat', 1000);
      const newTimestamp = 2000;

      db.updateChatLastMessage(chatId, newTimestamp);
      const chat = db.getChatById(chatId);

      expect(chat?.lastMessageAt).toBe(newTimestamp);
    });

    it('should increment unread count', () => {
      const chatId = db.createChat('Test Chat', Date.now());

      db.incrementUnreadCount(chatId);
      db.incrementUnreadCount(chatId);

      const chat = db.getChatById(chatId);
      expect(chat?.unreadCount).toBe(2);
    });

    it('should mark chat as read', () => {
      const chatId = db.createChat('Test Chat', Date.now());

      db.incrementUnreadCount(chatId);
      db.incrementUnreadCount(chatId);
      db.markChatAsRead(chatId);

      const chat = db.getChatById(chatId);
      expect(chat?.unreadCount).toBe(0);
    });
  });

  describe('Message Operations', () => {
    let chatId: number;

    beforeEach(() => {
      chatId = db.createChat('Test Chat', Date.now());
    });

    it('should create a new message', () => {
      const messageId = db.createMessage(chatId, Date.now(), 'Alice', 'Hello!');
      expect(messageId).toBeGreaterThan(0);
    });

    it('should get messages with pagination', () => {
      // Create 5 messages
      for (let i = 1; i <= 5; i++) {
        db.createMessage(chatId, Date.now() + i, 'Alice', `Message ${i}`);
      }

      const messages = db.getMessages(chatId, 3, 0);
      expect(messages).toHaveLength(3);

      // Should be ordered oldest first (reversed from DESC query)
      expect(messages[0].ts).toBeLessThan(messages[1].ts);
    });

    it('should search messages in a specific chat', () => {
      db.createMessage(chatId, Date.now(), 'Alice', 'Hello world');
      db.createMessage(chatId, Date.now() + 1, 'Bob', 'Goodbye world');
      db.createMessage(chatId, Date.now() + 2, 'Charlie', 'Nothing to see');

      const results = db.searchMessagesInChat(chatId, 'world', 10);
      expect(results).toHaveLength(2);
      expect(results.every(m => m.body.includes('world'))).toBe(true);
    });

    it('should search messages across all chats', () => {
      const chat1 = db.createChat('Chat 1', Date.now());
      const chat2 = db.createChat('Chat 2', Date.now());

      db.createMessage(chat1, Date.now(), 'Alice', 'Important message');
      db.createMessage(chat2, Date.now() + 1, 'Bob', 'Another important note');
      db.createMessage(chat1, Date.now() + 2, 'Charlie', 'Regular message');

      const results = db.searchMessagesAllChats('important', 10);
      expect(results).toHaveLength(2);
      expect(results.every(m => m.body.toLowerCase().includes('important'))).toBe(true);
    });

    it('should update chat timestamp when creating message', () => {
      const timestamp = Date.now();
      db.createMessage(chatId, timestamp, 'Alice', 'Test message');

      const chat = db.getChatById(chatId);
      expect(chat?.lastMessageAt).toBe(timestamp);
    });

    it('should increment unread count when creating message', () => {
      db.createMessage(chatId, Date.now(), 'Alice', 'Message 1');
      db.createMessage(chatId, Date.now() + 1, 'Bob', 'Message 2');

      const chat = db.getChatById(chatId);
      expect(chat?.unreadCount).toBe(2);
    });
  });

  describe('Database Statistics', () => {
    it('should return correct stats for empty database', () => {
      const stats = db.getStats();
      expect(stats.chats).toBe(0);
      expect(stats.messages).toBe(0);
    });

    it('should return correct stats after adding data', () => {
      const chatId = db.createChat('Test Chat', Date.now());
      db.createMessage(chatId, Date.now(), 'Alice', 'Message 1');
      db.createMessage(chatId, Date.now() + 1, 'Bob', 'Message 2');

      const stats = db.getStats();
      expect(stats.chats).toBe(1);
      expect(stats.messages).toBe(2);
    });
  });

  describe('Database Seeding', () => {
    it('should seed database with 200 chats and 20000+ messages', () => {
      db.seedData();

      const stats = db.getStats();
      expect(stats.chats).toBe(200);
      expect(stats.messages).toBeGreaterThan(20000);
    });

    it('should not seed database twice', () => {
      db.seedData();
      const firstStats = db.getStats();

      db.seedData();
      const secondStats = db.getStats();

      expect(firstStats).toEqual(secondStats);
    });
  });

  describe('Indexes', () => {
    it('should have indexes on chats table', () => {
      const indexes = (db as any).db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND tbl_name='chats'
      `).all();

      const indexNames = indexes.map((i: any) => i.name);
      expect(indexNames).toContain('idx_chats_lastMessageAt');
    });

    it('should have indexes on messages table', () => {
      const indexes = (db as any).db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND tbl_name='messages'
      `).all();

      const indexNames = indexes.map((i: any) => i.name);
      expect(indexNames).toContain('idx_messages_chatId_ts');
      expect(indexNames).toContain('idx_messages_body');
    });
  });
});
