import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';

export class DatabaseConnection {
  private db: Database.Database;
  private static instance: DatabaseConnection;

  private constructor(dbPath?: string) {
    const userDataPath = app.getPath('userData');
    const defaultPath = path.join(userDataPath, 'messenger.db');
    this.db = new Database(dbPath || defaultPath);

    // Enable WAL mode for better concurrency and performance
    this.db.pragma('journal_mode = WAL');

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    console.log(`[Database] Connected to ${dbPath || defaultPath}`);
  }

  public static getInstance(dbPath?: string): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(dbPath);
    }
    return DatabaseConnection.instance;
  }

  public getDatabase(): Database.Database {
    return this.db;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      console.log('[Database] Connection closed');
    }
  }

  /**
   * Initialize database schema
   */
  public initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        lastMessageAt INTEGER NOT NULL,
        unreadCount INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_chats_lastMessageAt
        ON chats(lastMessageAt DESC);

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chatId INTEGER NOT NULL,
        ts INTEGER NOT NULL,
        sender TEXT NOT NULL,
        body TEXT NOT NULL,
        editedAt INTEGER DEFAULT NULL,
        deletedAt INTEGER DEFAULT NULL,
        isDeleted INTEGER DEFAULT 0,
        FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chatId_ts
        ON messages(chatId, ts DESC);

      CREATE INDEX IF NOT EXISTS idx_messages_body
        ON messages(body);

      CREATE TABLE IF NOT EXISTS message_drafts (
        chatId INTEGER PRIMARY KEY,
        content TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS message_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        messageId INTEGER NOT NULL,
        chatId INTEGER NOT NULL,
        userId TEXT NOT NULL,
        emoji TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
        UNIQUE(messageId, userId, emoji)
      );

      CREATE INDEX IF NOT EXISTS idx_reactions_messageId
        ON message_reactions(messageId);

      CREATE TABLE IF NOT EXISTS read_receipts (
        messageId INTEGER NOT NULL,
        userId TEXT NOT NULL,
        readAt INTEGER NOT NULL,
        PRIMARY KEY (messageId, userId),
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_receipts_messageId
        ON read_receipts(messageId);

      CREATE TABLE IF NOT EXISTS message_replies (
        messageId INTEGER PRIMARY KEY,
        replyToMessageId INTEGER NOT NULL,
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (replyToMessageId) REFERENCES messages(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_replies_replyToMessageId
        ON message_replies(replyToMessageId);

      CREATE TABLE IF NOT EXISTS pinned_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        messageId INTEGER NOT NULL,
        chatId INTEGER NOT NULL,
        pinnedBy TEXT NOT NULL,
        pinnedAt INTEGER NOT NULL,
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
        UNIQUE(messageId, chatId)
      );

      CREATE INDEX IF NOT EXISTS idx_pinned_chatId
        ON pinned_messages(chatId);

      CREATE TABLE IF NOT EXISTS user_presence (
        userId TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        lastSeen INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS message_mentions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        messageId INTEGER NOT NULL,
        mentionedUserId TEXT NOT NULL,
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_mentions_messageId
        ON message_mentions(messageId);

      CREATE INDEX IF NOT EXISTS idx_mentions_userId
        ON message_mentions(mentionedUserId);

      -- Chat participants for group chats
      CREATE TABLE IF NOT EXISTS chat_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chatId INTEGER NOT NULL,
        userId TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        joinedAt INTEGER NOT NULL,
        FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
        UNIQUE(chatId, userId)
      );

      CREATE INDEX IF NOT EXISTS idx_participants_chatId
        ON chat_participants(chatId);

      CREATE INDEX IF NOT EXISTS idx_participants_userId
        ON chat_participants(userId);

      -- Media attachments
      CREATE TABLE IF NOT EXISTS media_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        messageId INTEGER NOT NULL,
        type TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileSize INTEGER NOT NULL,
        mimeType TEXT NOT NULL,
        filePath TEXT NOT NULL,
        thumbnailPath TEXT DEFAULT NULL,
        duration INTEGER DEFAULT NULL,
        width INTEGER DEFAULT NULL,
        height INTEGER DEFAULT NULL,
        uploadedAt INTEGER NOT NULL,
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_attachments_messageId
        ON media_attachments(messageId);

      CREATE INDEX IF NOT EXISTS idx_attachments_type
        ON media_attachments(type);

      -- Polls
      CREATE TABLE IF NOT EXISTS polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        messageId INTEGER NOT NULL,
        question TEXT NOT NULL,
        allowMultiple INTEGER DEFAULT 0,
        expiresAt INTEGER DEFAULT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_polls_messageId
        ON polls(messageId);

      CREATE TABLE IF NOT EXISTS poll_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pollId INTEGER NOT NULL,
        optionText TEXT NOT NULL,
        optionIndex INTEGER NOT NULL,
        FOREIGN KEY (pollId) REFERENCES polls(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_poll_options_pollId
        ON poll_options(pollId);

      CREATE TABLE IF NOT EXISTS poll_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pollId INTEGER NOT NULL,
        optionId INTEGER NOT NULL,
        userId TEXT NOT NULL,
        votedAt INTEGER NOT NULL,
        FOREIGN KEY (pollId) REFERENCES polls(id) ON DELETE CASCADE,
        FOREIGN KEY (optionId) REFERENCES poll_options(id) ON DELETE CASCADE,
        UNIQUE(pollId, optionId, userId)
      );

      CREATE INDEX IF NOT EXISTS idx_poll_votes_pollId
        ON poll_votes(pollId);

      CREATE INDEX IF NOT EXISTS idx_poll_votes_userId
        ON poll_votes(userId);

      -- Scheduled messages
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chatId INTEGER NOT NULL,
        sender TEXT NOT NULL,
        body TEXT NOT NULL,
        scheduledFor INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt INTEGER NOT NULL,
        sentAt INTEGER DEFAULT NULL,
        FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_scheduled_scheduledFor
        ON scheduled_messages(scheduledFor) WHERE status = 'pending';

      CREATE INDEX IF NOT EXISTS idx_scheduled_chatId
        ON scheduled_messages(chatId);

      -- Message translations (cache)
      CREATE TABLE IF NOT EXISTS message_translations (
        messageId INTEGER NOT NULL,
        targetLanguage TEXT NOT NULL,
        translatedText TEXT NOT NULL,
        translatedAt INTEGER NOT NULL,
        PRIMARY KEY (messageId, targetLanguage),
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_translations_messageId
        ON message_translations(messageId);

      -- User settings (including keyboard shortcuts, notification preferences, etc.)
      CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      -- Calls (WebRTC voice and video calls)
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        chatId INTEGER NOT NULL,
        type TEXT NOT NULL,
        initiatedBy TEXT NOT NULL,
        startedAt INTEGER NOT NULL,
        endedAt INTEGER DEFAULT NULL,
        status TEXT DEFAULT 'ringing',
        FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_calls_chatId
        ON calls(chatId);

      CREATE INDEX IF NOT EXISTS idx_calls_status
        ON calls(status);

      CREATE INDEX IF NOT EXISTS idx_calls_startedAt
        ON calls(startedAt DESC);

      CREATE TABLE IF NOT EXISTS call_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        callId TEXT NOT NULL,
        userId TEXT NOT NULL,
        joinedAt INTEGER DEFAULT NULL,
        leftAt INTEGER DEFAULT NULL,
        FOREIGN KEY (callId) REFERENCES calls(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_call_participants_callId
        ON call_participants(callId);

      CREATE INDEX IF NOT EXISTS idx_call_participants_userId
        ON call_participants(userId);

      -- Contacts table
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        avatar TEXT DEFAULT NULL,
        status TEXT DEFAULT NULL,
        lastSeen INTEGER DEFAULT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_contacts_name
        ON contacts(name COLLATE NOCASE);

      CREATE INDEX IF NOT EXISTS idx_contacts_userId
        ON contacts(userId);

      -- Users table for authentication
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        email TEXT UNIQUE,
        displayName TEXT,
        createdAt INTEGER NOT NULL,
        lastLoginAt INTEGER DEFAULT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
        ON users(username COLLATE NOCASE);

      CREATE INDEX IF NOT EXISTS idx_users_email
        ON users(email COLLATE NOCASE);

      -- Sessions table for session management
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        userId INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        createdAt INTEGER NOT NULL,
        expiresAt INTEGER NOT NULL,
        lastActivityAt INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_userId
        ON sessions(userId);

      CREATE INDEX IF NOT EXISTS idx_sessions_token
        ON sessions(token);

      CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt
        ON sessions(expiresAt);

      -- Chat encryption keys (per-chat encryption)
      CREATE TABLE IF NOT EXISTS chat_keys (
        chatId INTEGER PRIMARY KEY,
        encryptedKeys TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        createdAt INTEGER NOT NULL,
        lastRotatedAt INTEGER NOT NULL,
        FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_chat_keys_lastRotatedAt
        ON chat_keys(lastRotatedAt);

      -- Full-text search index
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(body, content=messages, content_rowid=id);
    `);

    // Create triggers for FTS5 synchronization
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, body) VALUES (new.id, new.body);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE rowid = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
        UPDATE messages_fts SET body = new.body WHERE rowid = new.id;
      END;
    `);

    console.log('[Database] Schema initialized');
  }
}
