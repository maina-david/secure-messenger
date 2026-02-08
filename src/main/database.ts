/**
 * @deprecated This file is being phased out in favor of the new service layer architecture.
 *
 * New architecture (preferred):
 * - Repositories: src/main/database/*.ts (MessageRepository, ChatRepository, UserRepository)
 * - Services: src/main/services/*.ts (MessageService, ChatService, AuthService)
 *
 * This file is kept for backward compatibility and will be removed in a future version.
 * For new features, use the service layer instead of DatabaseService.
 *
 * See ARCHITECTURE.md for details on the new architecture.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import * as crypto from 'crypto';

export interface Chat {
  id: number;
  title: string;
  lastMessageAt: number;
  unreadCount: number;
  disappearingMessageTimeout?: number | null;
  type?: 'direct' | 'group';
  createdBy?: string | null;
}

export interface ChatParticipant {
  id: number;
  chatId: number;
  userId: string;
  role: 'admin' | 'member';
  joinedAt: number;
}

export interface Message {
  id: number;
  chatId: number;
  ts: number;
  sender: string;
  body: string;
  editedAt?: number | null;
  deletedAt?: number | null;
  isDeleted?: number;
  forwardedFrom?: number | null;
  forwardCount?: number;
  expiresAt?: number | null;
  deliveredAt?: number | null;
}

export interface Reaction {
  id: number;
  messageId: number;
  chatId: number;
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface ReadReceipt {
  messageId: number;
  userId: string;
  readAt: number;
}

export interface PinnedMessage {
  id: number;
  messageId: number;
  chatId: number;
  pinnedBy: string;
  pinnedAt: number;
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
  updatedAt: number;
}

export interface Mention {
  id: number;
  messageId: number;
  mentionedUserId: string;
}

export interface MediaAttachment {
  id: number;
  messageId: number;
  type: 'image' | 'file' | 'voice' | 'video';
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  thumbnailPath?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  uploadedAt: number;
}

export interface Poll {
  id: number;
  messageId: number;
  question: string;
  allowMultiple: number;
  expiresAt?: number | null;
  createdAt: number;
}

export interface PollOption {
  id: number;
  pollId: number;
  optionText: string;
  optionIndex: number;
}

export interface PollVote {
  id: number;
  pollId: number;
  optionId: number;
  userId: string;
  votedAt: number;
}

export interface ScheduledMessage {
  id: number;
  chatId: number;
  sender: string;
  body: string;
  scheduledFor: number;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: number;
  sentAt?: number | null;
}

export interface MessageTranslation {
  messageId: number;
  targetLanguage: string;
  translatedText: string;
  translatedAt: number;
}

export interface UserSetting {
  key: string;
  value: string;
  updatedAt: number;
}

export interface KeyboardShortcut {
  action: string;
  key: string;
  modifiers: string[];
  description: string;
}

export interface Call {
  id: string;
  chatId: number;
  type: 'audio' | 'video';
  initiatedBy: string;
  startedAt: number;
  endedAt?: number | null;
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
}

export interface CallParticipant {
  id: number;
  callId: string;
  userId: string;
  joinedAt?: number | null;
  leftAt?: number | null;
}

export interface Contact {
  id: number;
  userId: string;
  name: string;
  avatar?: string | null;
  status?: string | null;
  lastSeen?: number | null;
  createdAt: number;
}

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  email?: string | null;
  displayName?: string | null;
  createdAt: number;
  lastLoginAt?: number | null;
}

export interface Session {
  id: string;
  userId: number;
  token: string;
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
}

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const userDataPath = app.getPath('userData');
    const defaultPath = path.join(userDataPath, 'messenger.db');
    this.db = new Database(dbPath || defaultPath);
    this.initialize();
  }

  private initialize() {
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
      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, body) VALUES (new.id, new.body);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, body) VALUES('delete', old.id, old.body);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, body) VALUES('delete', old.id, old.body);
        INSERT INTO messages_fts(rowid, body) VALUES (new.id, new.body);
      END;
    `);

    // Run migrations for existing databases
    this.runMigrations();
  }

  private runMigrations() {
    // Check if migration columns exist and add them if they don't
    const tableInfo = this.db.pragma('table_info(messages)') as Array<{ name: string }>;
    const columns = tableInfo.map((col) => col.name);

    if (!columns.includes('editedAt')) {
      console.log('Running migration: Adding editedAt column');
      this.db.exec('ALTER TABLE messages ADD COLUMN editedAt INTEGER DEFAULT NULL');
    }

    if (!columns.includes('deletedAt')) {
      console.log('Running migration: Adding deletedAt column');
      this.db.exec('ALTER TABLE messages ADD COLUMN deletedAt INTEGER DEFAULT NULL');
    }

    if (!columns.includes('isDeleted')) {
      console.log('Running migration: Adding isDeleted column');
      this.db.exec('ALTER TABLE messages ADD COLUMN isDeleted INTEGER DEFAULT 0');
    }

    if (!columns.includes('forwardedFrom')) {
      console.log('Running migration: Adding forwardedFrom column');
      this.db.exec('ALTER TABLE messages ADD COLUMN forwardedFrom INTEGER DEFAULT NULL');
    }

    if (!columns.includes('forwardCount')) {
      console.log('Running migration: Adding forwardCount column');
      this.db.exec('ALTER TABLE messages ADD COLUMN forwardCount INTEGER DEFAULT 0');
    }

    if (!columns.includes('expiresAt')) {
      console.log('Running migration: Adding expiresAt column');
      this.db.exec('ALTER TABLE messages ADD COLUMN expiresAt INTEGER DEFAULT NULL');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_expiresAt ON messages(expiresAt) WHERE expiresAt IS NOT NULL');
    }

    if (!columns.includes('deliveredAt')) {
      console.log('Running migration: Adding deliveredAt column');
      this.db.exec('ALTER TABLE messages ADD COLUMN deliveredAt INTEGER DEFAULT NULL');
    }

    // Check chats table for disappearing message timeout
    const chatTableInfo = this.db.pragma('table_info(chats)') as Array<{ name: string }>;
    const chatColumns = chatTableInfo.map((col) => col.name);

    if (!chatColumns.includes('disappearingMessageTimeout')) {
      console.log('Running migration: Adding disappearingMessageTimeout column to chats');
      this.db.exec('ALTER TABLE chats ADD COLUMN disappearingMessageTimeout INTEGER DEFAULT NULL');
    }

    if (!chatColumns.includes('type')) {
      console.log('Running migration: Adding type column to chats');
      this.db.exec("ALTER TABLE chats ADD COLUMN type TEXT DEFAULT 'direct'");
    }

    if (!chatColumns.includes('createdBy')) {
      console.log('Running migration: Adding createdBy column to chats');
      this.db.exec('ALTER TABLE chats ADD COLUMN createdBy TEXT DEFAULT NULL');
    }

    // Populate FTS5 index for existing messages
    const ftsCount = this.db.prepare('SELECT COUNT(*) as count FROM messages_fts').get() as { count: number };
    const messageCount = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };

    if (ftsCount.count === 0 && messageCount.count > 0) {
      console.log('Running migration: Populating FTS5 index');
      this.db.exec(`
        INSERT INTO messages_fts(rowid, body)
        SELECT id, body FROM messages;
      `);
    }
  }

  // Chat operations
  getChatList(limit: number = 50, offset: number = 0): Chat[] {
    const stmt = this.db.prepare(`
      SELECT id, title, lastMessageAt, unreadCount, disappearingMessageTimeout, type, createdBy
      FROM chats
      ORDER BY lastMessageAt DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as Chat[];
  }

  getChatById(chatId: number): Chat | undefined {
    const stmt = this.db.prepare(`
      SELECT id, title, lastMessageAt, unreadCount, disappearingMessageTimeout, type, createdBy
      FROM chats
      WHERE id = ?
    `);
    return stmt.get(chatId) as Chat | undefined;
  }

  createChat(title: string, lastMessageAt: number): number {
    const stmt = this.db.prepare(`
      INSERT INTO chats (title, lastMessageAt, unreadCount, type)
      VALUES (?, ?, 0, 'direct')
    `);
    const result = stmt.run(title, lastMessageAt);
    return result.lastInsertRowid as number;
  }

  createGroupChat(title: string, createdBy: string, participantIds: string[]): number | null {
    try {
      const now = Date.now();

      // Create the group chat
      const stmt = this.db.prepare(`
        INSERT INTO chats (title, lastMessageAt, unreadCount, type, createdBy)
        VALUES (?, ?, 0, 'group', ?)
      `);
      const result = stmt.run(title, now, createdBy);
      const chatId = result.lastInsertRowid as number;

      // Add creator as admin
      this.addChatParticipant(chatId, createdBy, 'admin');

      // Add other participants as members
      for (const userId of participantIds) {
        if (userId !== createdBy) {
          this.addChatParticipant(chatId, userId, 'member');
        }
      }

      return chatId;
    } catch (error) {
      console.error('Error creating group chat:', error);
      return null;
    }
  }

  // Chat keys management for per-chat encryption
  storeChatKeys(chatId: number, encryptedKeys: string, version: number = 1): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO chat_keys (chatId, encryptedKeys, version, createdAt, lastRotatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(chatId) DO UPDATE SET
        encryptedKeys = excluded.encryptedKeys,
        version = excluded.version,
        lastRotatedAt = excluded.lastRotatedAt
    `);
    stmt.run(chatId, encryptedKeys, version, now, now);
  }

  getChatKeys(chatId: number): { encryptedKeys: string; version: number; createdAt: number; lastRotatedAt: number } | null {
    const stmt = this.db.prepare(`
      SELECT encryptedKeys, version, createdAt, lastRotatedAt
      FROM chat_keys
      WHERE chatId = ?
    `);
    return stmt.get(chatId) as any || null;
  }

  updateChatKeys(chatId: number, encryptedKeys: string, version: number): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE chat_keys
      SET encryptedKeys = ?, version = ?, lastRotatedAt = ?
      WHERE chatId = ?
    `);
    stmt.run(encryptedKeys, version, now, chatId);
  }

  deleteChatKeys(chatId: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM chat_keys WHERE chatId = ?
    `);
    stmt.run(chatId);
  }

  getAllChatsNeedingKeyRotation(daysThreshold: number = 30): number[] {
    const thresholdTimestamp = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);
    const stmt = this.db.prepare(`
      SELECT chatId
      FROM chat_keys
      WHERE lastRotatedAt < ?
    `);
    const rows = stmt.all(thresholdTimestamp) as { chatId: number }[];
    return rows.map(row => row.chatId);
  }

  updateChatLastMessage(chatId: number, timestamp: number) {
    const stmt = this.db.prepare(`
      UPDATE chats
      SET lastMessageAt = ?
      WHERE id = ?
    `);
    stmt.run(timestamp, chatId);
  }

  incrementUnreadCount(chatId: number) {
    const stmt = this.db.prepare(`
      UPDATE chats
      SET unreadCount = unreadCount + 1
      WHERE id = ?
    `);
    stmt.run(chatId);
  }

  markChatAsRead(chatId: number) {
    const stmt = this.db.prepare(`
      UPDATE chats
      SET unreadCount = 0
      WHERE id = ?
    `);
    stmt.run(chatId);
  }

  // Chat participant operations (for group chats)
  addChatParticipant(chatId: number, userId: string, role: 'admin' | 'member' = 'member'): number | null {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO chat_participants (chatId, userId, role, joinedAt)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(chatId, userId, role, Date.now());
      return result.lastInsertRowid as number;
    } catch (error) {
      // If unique constraint violated, user is already a participant
      console.error('Error adding chat participant:', error);
      return null;
    }
  }

  removeChatParticipant(chatId: number, userId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM chat_participants
      WHERE chatId = ? AND userId = ?
    `);
    const result = stmt.run(chatId, userId);
    return result.changes > 0;
  }

  getChatParticipants(chatId: number): ChatParticipant[] {
    const stmt = this.db.prepare(`
      SELECT id, chatId, userId, role, joinedAt
      FROM chat_participants
      WHERE chatId = ?
      ORDER BY joinedAt ASC
    `);
    return stmt.all(chatId) as ChatParticipant[];
  }

  getChatParticipantRole(chatId: number, userId: string): 'admin' | 'member' | null {
    const stmt = this.db.prepare(`
      SELECT role FROM chat_participants
      WHERE chatId = ? AND userId = ?
    `);
    const result = stmt.get(chatId, userId) as { role: 'admin' | 'member' } | undefined;
    return result?.role || null;
  }

  updateChatParticipantRole(chatId: number, userId: string, role: 'admin' | 'member'): boolean {
    const stmt = this.db.prepare(`
      UPDATE chat_participants
      SET role = ?
      WHERE chatId = ? AND userId = ?
    `);
    const result = stmt.run(role, chatId, userId);
    return result.changes > 0;
  }

  isUserInChat(chatId: number, userId: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM chat_participants
      WHERE chatId = ? AND userId = ?
    `);
    const result = stmt.get(chatId, userId) as { count: number };
    return result.count > 0;
  }

  getUserChats(userId: string, limit: number = 50, offset: number = 0): Chat[] {
    const stmt = this.db.prepare(`
      SELECT c.id, c.title, c.lastMessageAt, c.unreadCount, c.disappearingMessageTimeout, c.type, c.createdBy
      FROM chats c
      INNER JOIN chat_participants cp ON c.id = cp.chatId
      WHERE cp.userId = ?
      ORDER BY c.lastMessageAt DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(userId, limit, offset) as Chat[];
  }

  // Media attachment operations
  addMediaAttachment(
    messageId: number,
    type: 'image' | 'file' | 'voice' | 'video',
    fileName: string,
    fileSize: number,
    mimeType: string,
    filePath: string,
    options?: {
      thumbnailPath?: string;
      duration?: number;
      width?: number;
      height?: number;
    }
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO media_attachments (
        messageId, type, fileName, fileSize, mimeType, filePath,
        thumbnailPath, duration, width, height, uploadedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      messageId,
      type,
      fileName,
      fileSize,
      mimeType,
      filePath,
      options?.thumbnailPath || null,
      options?.duration || null,
      options?.width || null,
      options?.height || null,
      Date.now()
    );
    return result.lastInsertRowid as number;
  }

  getMediaAttachments(messageId: number): MediaAttachment[] {
    const stmt = this.db.prepare(`
      SELECT id, messageId, type, fileName, fileSize, mimeType, filePath,
             thumbnailPath, duration, width, height, uploadedAt
      FROM media_attachments
      WHERE messageId = ?
      ORDER BY uploadedAt ASC
    `);
    return stmt.all(messageId) as MediaAttachment[];
  }

  getMediaAttachmentById(attachmentId: number): MediaAttachment | undefined {
    const stmt = this.db.prepare(`
      SELECT id, messageId, type, fileName, fileSize, mimeType, filePath,
             thumbnailPath, duration, width, height, uploadedAt
      FROM media_attachments
      WHERE id = ?
    `);
    return stmt.get(attachmentId) as MediaAttachment | undefined;
  }

  getMediaAttachmentsByChat(chatId: number, type?: 'image' | 'file' | 'voice' | 'video'): MediaAttachment[] {
    let sql = `
      SELECT ma.id, ma.messageId, ma.type, ma.fileName, ma.fileSize, ma.mimeType, ma.filePath,
             ma.thumbnailPath, ma.duration, ma.width, ma.height, ma.uploadedAt
      FROM media_attachments ma
      INNER JOIN messages m ON ma.messageId = m.id
      WHERE m.chatId = ?
    `;
    const params: any[] = [chatId];

    if (type) {
      sql += ' AND ma.type = ?';
      params.push(type);
    }

    sql += ' ORDER BY ma.uploadedAt DESC';

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as MediaAttachment[];
  }

  deleteMediaAttachment(attachmentId: number): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM media_attachments WHERE id = ?
    `);
    const result = stmt.run(attachmentId);
    return result.changes > 0;
  }

  // Poll operations
  createPoll(
    messageId: number,
    question: string,
    options: string[],
    allowMultiple: boolean = false,
    expiresAt?: number
  ): number | null {
    try {
      // Create the poll
      const pollStmt = this.db.prepare(`
        INSERT INTO polls (messageId, question, allowMultiple, expiresAt, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `);
      const pollResult = pollStmt.run(
        messageId,
        question,
        allowMultiple ? 1 : 0,
        expiresAt || null,
        Date.now()
      );
      const pollId = pollResult.lastInsertRowid as number;

      // Create poll options
      const optionStmt = this.db.prepare(`
        INSERT INTO poll_options (pollId, optionText, optionIndex)
        VALUES (?, ?, ?)
      `);

      for (let i = 0; i < options.length; i++) {
        optionStmt.run(pollId, options[i], i);
      }

      return pollId;
    } catch (error) {
      console.error('Error creating poll:', error);
      return null;
    }
  }

  getPoll(pollId: number): Poll | undefined {
    const stmt = this.db.prepare(`
      SELECT id, messageId, question, allowMultiple, expiresAt, createdAt
      FROM polls
      WHERE id = ?
    `);
    return stmt.get(pollId) as Poll | undefined;
  }

  getPollByMessage(messageId: number): Poll | undefined {
    const stmt = this.db.prepare(`
      SELECT id, messageId, question, allowMultiple, expiresAt, createdAt
      FROM polls
      WHERE messageId = ?
    `);
    return stmt.get(messageId) as Poll | undefined;
  }

  getPollOptions(pollId: number): PollOption[] {
    const stmt = this.db.prepare(`
      SELECT id, pollId, optionText, optionIndex
      FROM poll_options
      WHERE pollId = ?
      ORDER BY optionIndex ASC
    `);
    return stmt.all(pollId) as PollOption[];
  }

  votePoll(pollId: number, optionId: number, userId: string): boolean {
    try {
      // Check if poll allows multiple votes or if user hasn't voted yet
      const poll = this.getPoll(pollId);
      if (!poll) return false;

      // Check if poll has expired
      if (poll.expiresAt && poll.expiresAt < Date.now()) {
        return false;
      }

      // If single choice, remove any existing votes from this user
      if (!poll.allowMultiple) {
        const deleteStmt = this.db.prepare(`
          DELETE FROM poll_votes
          WHERE pollId = ? AND userId = ?
        `);
        deleteStmt.run(pollId, userId);
      }

      // Add the vote
      const stmt = this.db.prepare(`
        INSERT INTO poll_votes (pollId, optionId, userId, votedAt)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(pollId, optionId, userId, Date.now());
      return true;
    } catch (error) {
      // If unique constraint violated, vote already exists (for multi-choice polls)
      console.error('Error voting on poll:', error);
      return false;
    }
  }

  removePollVote(pollId: number, optionId: number, userId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM poll_votes
      WHERE pollId = ? AND optionId = ? AND userId = ?
    `);
    const result = stmt.run(pollId, optionId, userId);
    return result.changes > 0;
  }

  getPollVotes(pollId: number): PollVote[] {
    const stmt = this.db.prepare(`
      SELECT id, pollId, optionId, userId, votedAt
      FROM poll_votes
      WHERE pollId = ?
      ORDER BY votedAt ASC
    `);
    return stmt.all(pollId) as PollVote[];
  }

  getPollResults(pollId: number): Record<number, { optionId: number; optionText: string; count: number; voters: string[] }> {
    const options = this.getPollOptions(pollId);
    const votes = this.getPollVotes(pollId);

    const results: Record<number, { optionId: number; optionText: string; count: number; voters: string[] }> = {};

    // Initialize results
    for (const option of options) {
      results[option.id] = {
        optionId: option.id,
        optionText: option.optionText,
        count: 0,
        voters: []
      };
    }

    // Count votes
    for (const vote of votes) {
      if (results[vote.optionId]) {
        results[vote.optionId].count++;
        results[vote.optionId].voters.push(vote.userId);
      }
    }

    return results;
  }

  getUserPollVotes(pollId: number, userId: string): number[] {
    const stmt = this.db.prepare(`
      SELECT optionId
      FROM poll_votes
      WHERE pollId = ? AND userId = ?
    `);
    const results = stmt.all(pollId, userId) as Array<{ optionId: number }>;
    return results.map(r => r.optionId);
  }

  // Scheduled message operations
  scheduleMessage(chatId: number, sender: string, body: string, scheduledFor: number): number {
    const stmt = this.db.prepare(`
      INSERT INTO scheduled_messages (chatId, sender, body, scheduledFor, status, createdAt)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `);
    const result = stmt.run(chatId, sender, body, scheduledFor, Date.now());
    return result.lastInsertRowid as number;
  }

  getScheduledMessage(id: number): ScheduledMessage | undefined {
    const stmt = this.db.prepare(`
      SELECT id, chatId, sender, body, scheduledFor, status, createdAt, sentAt
      FROM scheduled_messages
      WHERE id = ?
    `);
    return stmt.get(id) as ScheduledMessage | undefined;
  }

  getScheduledMessages(chatId: number, status?: 'pending' | 'sent' | 'cancelled'): ScheduledMessage[] {
    let sql = `
      SELECT id, chatId, sender, body, scheduledFor, status, createdAt, sentAt
      FROM scheduled_messages
      WHERE chatId = ?
    `;
    const params: any[] = [chatId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY scheduledFor ASC';

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as ScheduledMessage[];
  }

  getAllPendingScheduledMessages(): ScheduledMessage[] {
    const stmt = this.db.prepare(`
      SELECT id, chatId, sender, body, scheduledFor, status, createdAt, sentAt
      FROM scheduled_messages
      WHERE status = 'pending'
      ORDER BY scheduledFor ASC
    `);
    return stmt.all() as ScheduledMessage[];
  }

  getDueScheduledMessages(): ScheduledMessage[] {
    const now = Date.now();
    const stmt = this.db.prepare(`
      SELECT id, chatId, sender, body, scheduledFor, status, createdAt, sentAt
      FROM scheduled_messages
      WHERE status = 'pending' AND scheduledFor <= ?
      ORDER BY scheduledFor ASC
    `);
    return stmt.all(now) as ScheduledMessage[];
  }

  cancelScheduledMessage(id: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE scheduled_messages
      SET status = 'cancelled'
      WHERE id = ? AND status = 'pending'
    `);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  markScheduledMessageSent(id: number, messageId: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE scheduled_messages
      SET status = 'sent', sentAt = ?
      WHERE id = ?
    `);
    const result = stmt.run(Date.now(), id);
    return result.changes > 0;
  }

  deleteScheduledMessage(id: number): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM scheduled_messages
      WHERE id = ?
    `);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Translation operations
  saveTranslation(messageId: number, targetLanguage: string, translatedText: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO message_translations (messageId, targetLanguage, translatedText, translatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(messageId, targetLanguage) DO UPDATE SET
        translatedText = ?,
        translatedAt = ?
    `);
    const now = Date.now();
    stmt.run(messageId, targetLanguage, translatedText, now, translatedText, now);
  }

  getTranslation(messageId: number, targetLanguage: string): MessageTranslation | null {
    const stmt = this.db.prepare(`
      SELECT messageId, targetLanguage, translatedText, translatedAt
      FROM message_translations
      WHERE messageId = ? AND targetLanguage = ?
    `);
    const result = stmt.get(messageId, targetLanguage) as MessageTranslation | undefined;
    return result || null;
  }

  getMessageTranslations(messageId: number): MessageTranslation[] {
    const stmt = this.db.prepare(`
      SELECT messageId, targetLanguage, translatedText, translatedAt
      FROM message_translations
      WHERE messageId = ?
      ORDER BY translatedAt DESC
    `);
    return stmt.all(messageId) as MessageTranslation[];
  }

  deleteTranslation(messageId: number, targetLanguage: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM message_translations
      WHERE messageId = ? AND targetLanguage = ?
    `);
    const result = stmt.run(messageId, targetLanguage);
    return result.changes > 0;
  }

  deleteAllTranslations(messageId: number): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM message_translations
      WHERE messageId = ?
    `);
    const result = stmt.run(messageId);
    return result.changes > 0;
  }

  // Message operations
  getMessages(chatId: number, limit: number = 50, offset: number = 0): Message[] {
    const stmt = this.db.prepare(`
      SELECT id, chatId, ts, sender, body, editedAt, deletedAt, isDeleted, forwardedFrom, forwardCount, expiresAt
      FROM messages
      WHERE chatId = ?
      ORDER BY ts DESC
      LIMIT ? OFFSET ?
    `);
    const messages = stmt.all(chatId, limit, offset) as Message[];
    // Reverse to show oldest first
    return messages.reverse();
  }

  searchMessages(chatId: number, query: string, limit: number = 50): Message[] {
    const stmt = this.db.prepare(`
      SELECT id, chatId, ts, sender, body, editedAt, deletedAt, isDeleted, forwardedFrom, forwardCount, expiresAt
      FROM messages
      WHERE chatId = ? AND body LIKE ? AND isDeleted = 0
      ORDER BY ts DESC
      LIMIT ?
    `);
    const messages = stmt.all(chatId, `%${query}%`, limit) as Message[];
    return messages.reverse();
  }

  editMessage(messageId: number, newBody: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE messages
      SET body = ?, editedAt = ?
      WHERE id = ? AND isDeleted = 0
    `);
    const result = stmt.run(newBody, Date.now(), messageId);
    return result.changes > 0;
  }

  deleteMessage(messageId: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE messages
      SET isDeleted = 1, deletedAt = ?
      WHERE id = ?
    `);
    const result = stmt.run(Date.now(), messageId);
    return result.changes > 0;
  }

  getMessageById(messageId: number): Message | undefined {
    const stmt = this.db.prepare(`
      SELECT id, chatId, ts, sender, body, editedAt, deletedAt, isDeleted, forwardedFrom, forwardCount, expiresAt
      FROM messages
      WHERE id = ?
    `);
    return stmt.get(messageId) as Message | undefined;
  }

  createMessage(chatId: number, ts: number, sender: string, body: string): number {
    // Check if chat has disappearing message timeout
    const chat = this.getChatById(chatId);
    const expiresAt = chat?.disappearingMessageTimeout
      ? ts + chat.disappearingMessageTimeout
      : null;

    const stmt = this.db.prepare(`
      INSERT INTO messages (chatId, ts, sender, body, expiresAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(chatId, ts, sender, body, expiresAt);

    // Update chat's lastMessageAt and increment unread count
    this.updateChatLastMessage(chatId, ts);
    this.incrementUnreadCount(chatId);

    return result.lastInsertRowid as number;
  }

  searchMessagesInChat(chatId: number, query: string, limit: number = 50): Message[] {
    const stmt = this.db.prepare(`
      SELECT id, chatId, ts, sender, body, editedAt, deletedAt, isDeleted
      FROM messages
      WHERE chatId = ? AND body LIKE ?
      ORDER BY ts DESC
      LIMIT ?
    `);
    return stmt.all(chatId, `%${query}%`, limit) as Message[];
  }

  // Mark message as delivered
  markMessageDelivered(messageId: number): void {
    const stmt = this.db.prepare(`
      UPDATE messages
      SET deliveredAt = ?
      WHERE id = ? AND deliveredAt IS NULL
    `);
    stmt.run(Date.now(), messageId);
  }

  // Get delivery status for a message
  getDeliveryStatus(messageId: number): { delivered: boolean; deliveredAt: number | null } {
    const stmt = this.db.prepare(`
      SELECT deliveredAt
      FROM messages
      WHERE id = ?
    `);
    const result = stmt.get(messageId) as { deliveredAt: number | null } | undefined;
    return {
      delivered: result?.deliveredAt !== null && result?.deliveredAt !== undefined,
      deliveredAt: result?.deliveredAt || null,
    };
  }

  searchMessagesAllChats(query: string, limit: number = 50): Message[] {
    const stmt = this.db.prepare(`
      SELECT id, chatId, ts, sender, body, editedAt, deletedAt, isDeleted
      FROM messages
      WHERE body LIKE ?
      ORDER BY ts DESC
      LIMIT ?
    `);
    return stmt.all(`%${query}%`, limit) as Message[];
  }

  // Draft operations
  saveDraft(chatId: number, content: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO message_drafts (chatId, content, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(chatId) DO UPDATE SET content = ?, updatedAt = ?
    `);
    const now = Date.now();
    stmt.run(chatId, content, now, content, now);
  }

  getDraft(chatId: number): string | null {
    const stmt = this.db.prepare(`
      SELECT content FROM message_drafts WHERE chatId = ?
    `);
    const result = stmt.get(chatId) as { content: string } | undefined;
    return result?.content || null;
  }

  deleteDraft(chatId: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM message_drafts WHERE chatId = ?
    `);
    stmt.run(chatId);
  }

  // Reaction operations
  addReaction(messageId: number, chatId: number, userId: string, emoji: string): number | null {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO message_reactions (messageId, chatId, userId, emoji, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(messageId, chatId, userId, emoji, Date.now());
      return result.lastInsertRowid as number;
    } catch (error) {
      // If unique constraint violated, user already reacted with this emoji
      return null;
    }
  }

  removeReaction(messageId: number, userId: string, emoji: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM message_reactions
      WHERE messageId = ? AND userId = ? AND emoji = ?
    `);
    const result = stmt.run(messageId, userId, emoji);
    return result.changes > 0;
  }

  getReactions(messageId: number): Reaction[] {
    const stmt = this.db.prepare(`
      SELECT id, messageId, chatId, userId, emoji, createdAt
      FROM message_reactions
      WHERE messageId = ?
      ORDER BY createdAt ASC
    `);
    return stmt.all(messageId) as Reaction[];
  }

  getReactionsByChat(chatId: number): Record<number, Reaction[]> {
    const stmt = this.db.prepare(`
      SELECT id, messageId, chatId, userId, emoji, createdAt
      FROM message_reactions
      WHERE chatId = ?
      ORDER BY messageId, createdAt ASC
    `);
    const reactions = stmt.all(chatId) as Reaction[];

    // Group by messageId
    const grouped: Record<number, Reaction[]> = {};
    for (const reaction of reactions) {
      if (!grouped[reaction.messageId]) {
        grouped[reaction.messageId] = [];
      }
      grouped[reaction.messageId].push(reaction);
    }
    return grouped;
  }

  // Read receipt operations
  markMessageAsRead(messageId: number, userId: string): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO read_receipts (messageId, userId, readAt)
        VALUES (?, ?, ?)
        ON CONFLICT(messageId, userId) DO UPDATE SET readAt = ?
      `);
      const now = Date.now();
      stmt.run(messageId, userId, now, now);
      return true;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  }

  getReadReceipts(messageId: number): ReadReceipt[] {
    const stmt = this.db.prepare(`
      SELECT messageId, userId, readAt
      FROM read_receipts
      WHERE messageId = ?
      ORDER BY readAt ASC
    `);
    return stmt.all(messageId) as ReadReceipt[];
  }

  getReadReceiptsByChat(chatId: number): Record<number, ReadReceipt[]> {
    const stmt = this.db.prepare(`
      SELECT r.messageId, r.userId, r.readAt
      FROM read_receipts r
      INNER JOIN messages m ON r.messageId = m.id
      WHERE m.chatId = ?
      ORDER BY r.messageId, r.readAt ASC
    `);
    const receipts = stmt.all(chatId) as ReadReceipt[];

    // Group by messageId
    const grouped: Record<number, ReadReceipt[]> = {};
    for (const receipt of receipts) {
      if (!grouped[receipt.messageId]) {
        grouped[receipt.messageId] = [];
      }
      grouped[receipt.messageId].push(receipt);
    }
    return grouped;
  }

  // Reply operations
  setMessageReply(messageId: number, replyToMessageId: number): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO message_replies (messageId, replyToMessageId)
        VALUES (?, ?)
        ON CONFLICT(messageId) DO UPDATE SET replyToMessageId = ?
      `);
      stmt.run(messageId, replyToMessageId, replyToMessageId);
      return true;
    } catch (error) {
      console.error('Error setting message reply:', error);
      return false;
    }
  }

  getMessageReply(messageId: number): number | null {
    const stmt = this.db.prepare(`
      SELECT replyToMessageId FROM message_replies WHERE messageId = ?
    `);
    const result = stmt.get(messageId) as { replyToMessageId: number } | undefined;
    return result?.replyToMessageId || null;
  }

  getRepliesTo(messageId: number): Message[] {
    const stmt = this.db.prepare(`
      SELECT m.id, m.chatId, m.ts, m.sender, m.body, m.editedAt, m.deletedAt, m.isDeleted
      FROM messages m
      INNER JOIN message_replies r ON m.id = r.messageId
      WHERE r.replyToMessageId = ?
      ORDER BY m.ts ASC
    `);
    return stmt.all(messageId) as Message[];
  }

  deleteMessageReply(messageId: number): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM message_replies WHERE messageId = ?
    `);
    const result = stmt.run(messageId);
    return result.changes > 0;
  }

  // Pinned message operations
  pinMessage(messageId: number, chatId: number, pinnedBy: string): number | null {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO pinned_messages (messageId, chatId, pinnedBy, pinnedAt)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(messageId, chatId, pinnedBy, Date.now());
      return result.lastInsertRowid as number;
    } catch (error) {
      // If unique constraint violated, message is already pinned
      console.error('Error pinning message:', error);
      return null;
    }
  }

  unpinMessage(messageId: number, chatId: number): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM pinned_messages
      WHERE messageId = ? AND chatId = ?
    `);
    const result = stmt.run(messageId, chatId);
    return result.changes > 0;
  }

  getPinnedMessages(chatId: number): PinnedMessage[] {
    const stmt = this.db.prepare(`
      SELECT id, messageId, chatId, pinnedBy, pinnedAt
      FROM pinned_messages
      WHERE chatId = ?
      ORDER BY pinnedAt DESC
    `);
    return stmt.all(chatId) as PinnedMessage[];
  }

  isPinned(messageId: number, chatId: number): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM pinned_messages
      WHERE messageId = ? AND chatId = ?
    `);
    const result = stmt.get(messageId, chatId) as { count: number };
    return result.count > 0;
  }

  // Presence operations
  updatePresence(userId: string, status: 'online' | 'offline' | 'away'): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO user_presence (userId, status, lastSeen, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET status = ?, lastSeen = ?, updatedAt = ?
    `);
    stmt.run(userId, status, now, now, status, now, now);
  }

  getUserPresence(userId: string): UserPresence | null {
    const stmt = this.db.prepare(`
      SELECT userId, status, lastSeen, updatedAt
      FROM user_presence
      WHERE userId = ?
    `);
    const result = stmt.get(userId) as UserPresence | undefined;
    return result || null;
  }

  getAllPresence(): UserPresence[] {
    const stmt = this.db.prepare(`
      SELECT userId, status, lastSeen, updatedAt
      FROM user_presence
      ORDER BY updatedAt DESC
    `);
    return stmt.all() as UserPresence[];
  }

  // Mention operations
  addMention(messageId: number, mentionedUserId: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO message_mentions (messageId, mentionedUserId)
      VALUES (?, ?)
    `);
    const result = stmt.run(messageId, mentionedUserId);
    return result.lastInsertRowid as number;
  }

  getMentionsByMessage(messageId: number): Mention[] {
    const stmt = this.db.prepare(`
      SELECT id, messageId, mentionedUserId
      FROM message_mentions
      WHERE messageId = ?
    `);
    return stmt.all(messageId) as Mention[];
  }

  getMentionsByUser(userId: string, limit: number = 50): Message[] {
    const stmt = this.db.prepare(`
      SELECT m.id, m.chatId, m.ts, m.sender, m.body, m.editedAt, m.deletedAt, m.isDeleted
      FROM messages m
      INNER JOIN message_mentions mm ON m.id = mm.messageId
      WHERE mm.mentionedUserId = ?
      ORDER BY m.ts DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as Message[];
  }

  deleteMentionsByMessage(messageId: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM message_mentions WHERE messageId = ?
    `);
    stmt.run(messageId);
  }

  // Helper to parse and extract mentions from message body
  parseMentions(body: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(body)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }

  // Message forwarding operations
  forwardMessage(originalMessageId: number, targetChatId: number, sender: string): number | null {
    try {
      // Get the original message
      const originalMessage = this.getMessageById(originalMessageId);
      if (!originalMessage || originalMessage.isDeleted) {
        return null;
      }

      // Create a new message in the target chat
      const timestamp = Date.now();
      const stmt = this.db.prepare(`
        INSERT INTO messages (chatId, ts, sender, body, forwardedFrom, forwardCount)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        targetChatId,
        timestamp,
        sender,
        originalMessage.body,
        originalMessageId,
        0
      );

      // Update forward count on original message
      const updateStmt = this.db.prepare(`
        UPDATE messages
        SET forwardCount = forwardCount + 1
        WHERE id = ?
      `);
      updateStmt.run(originalMessageId);

      // Update chat's lastMessageAt
      this.updateChatLastMessage(targetChatId, timestamp);

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error forwarding message:', error);
      return null;
    }
  }

  // Disappearing messages operations
  setDisappearingTimeout(chatId: number, timeout: number | null): boolean {
    const stmt = this.db.prepare(`
      UPDATE chats
      SET disappearingMessageTimeout = ?
      WHERE id = ?
    `);
    const result = stmt.run(timeout, chatId);
    return result.changes > 0;
  }

  getDisappearingTimeout(chatId: number): number | null {
    const chat = this.getChatById(chatId);
    return chat?.disappearingMessageTimeout || null;
  }

  cleanupExpiredMessages(): number {
    const now = Date.now();
    const stmt = this.db.prepare(`
      DELETE FROM messages
      WHERE expiresAt IS NOT NULL AND expiresAt < ?
    `);
    const result = stmt.run(now);
    return result.changes;
  }

  getExpiredMessages(): Message[] {
    const now = Date.now();
    const stmt = this.db.prepare(`
      SELECT id, chatId, ts, sender, body, editedAt, deletedAt, isDeleted, forwardedFrom, forwardCount, expiresAt
      FROM messages
      WHERE expiresAt IS NOT NULL AND expiresAt < ?
    `);
    return stmt.all(now) as Message[];
  }

  // Advanced search with filters using FTS5
  searchMessagesAdvanced(options: {
    query: string;
    chatId?: number;
    sender?: string;
    dateFrom?: number;
    dateTo?: number;
    limit?: number;
  }): Message[] {
    const { query, chatId, sender, dateFrom, dateTo, limit = 50 } = options;

    let sql = `
      SELECT m.id, m.chatId, m.ts, m.sender, m.body, m.editedAt, m.deletedAt, m.isDeleted, m.forwardedFrom, m.forwardCount, m.expiresAt
      FROM messages m
      INNER JOIN messages_fts fts ON m.id = fts.rowid
      WHERE fts.body MATCH ?
    `;

    const params: any[] = [query];

    if (chatId !== undefined) {
      sql += ' AND m.chatId = ?';
      params.push(chatId);
    }

    if (sender) {
      sql += ' AND m.sender = ?';
      params.push(sender);
    }

    if (dateFrom !== undefined) {
      sql += ' AND m.ts >= ?';
      params.push(dateFrom);
    }

    if (dateTo !== undefined) {
      sql += ' AND m.ts <= ?';
      params.push(dateTo);
    }

    sql += ' ORDER BY m.ts DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as Message[];
  }

  // Get all unique senders (for filter UI)
  getAllSenders(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT sender FROM messages ORDER BY sender
    `);
    const results = stmt.all() as Array<{ sender: string }>;
    return results.map(r => r.sender);
  }

  // Contacts methods
  getContacts(limit: number = 100, offset: number = 0): Contact[] {
    const stmt = this.db.prepare(`
      SELECT * FROM contacts
      ORDER BY name COLLATE NOCASE
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as Contact[];
  }

  searchContacts(query: string): Contact[] {
    const stmt = this.db.prepare(`
      SELECT * FROM contacts
      WHERE name LIKE ? OR userId LIKE ?
      ORDER BY name COLLATE NOCASE
      LIMIT 50
    `);
    const searchTerm = `%${query}%`;
    return stmt.all(searchTerm, searchTerm) as Contact[];
  }

  createChatWithContact(contactUserId: string): number | null {
    try {
      // Check if contact exists
      const contact = this.db.prepare('SELECT * FROM contacts WHERE userId = ?').get(contactUserId) as Contact | undefined;
      if (!contact) {
        return null;
      }

      // Check if chat already exists with this contact
      const existingChat = this.db.prepare(`
        SELECT id FROM chats WHERE title = ?
      `).get(contact.name) as { id: number } | undefined;

      if (existingChat) {
        return existingChat.id;
      }

      // Create new chat
      const result = this.db.prepare(`
        INSERT INTO chats (title, lastMessageAt, unreadCount)
        VALUES (?, ?, 0)
      `).run(contact.name, Date.now());

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error creating chat with contact:', error);
      return null;
    }
  }

  // Clear all data from database
  clearDatabase() {
    console.log('Clearing database...');
    const tables = [
      'messages',
      'chats',
      'message_drafts',
      'message_reactions',
      'message_replies',
      'pinned_messages',
      'read_receipts',
      'user_presence',
      'message_mentions',
      'media_attachments',
      'polls',
      'poll_options',
      'poll_votes',
      'scheduled_messages',
      'message_translations',
      'keyboard_shortcuts',
      'user_settings',
      'calls',
      'call_participants',
      'contacts',
      'messages_fts'
    ];

    for (const table of tables) {
      try {
        this.db.prepare(`DELETE FROM ${table}`).run();
      } catch (error) {
        // Table might not exist, ignore error
      }
    }
    console.log('Database cleared');
  }

  // Seed data for testing
  seedData() {
    // Clear existing data before reseeding
    console.log('Clearing existing data...');
    this.clearDatabase();

    console.log('Seeding database...');

    const chatIds: number[] = [];
    const now = Date.now();

    // Realistic user names for chats and contacts
    const userNames = [
      'Sarah Johnson', 'Michael Chen', 'Emily Rodriguez', 'David Kim', 'Jessica Martinez',
      'James Wilson', 'Ashley Thompson', 'Christopher Lee', 'Amanda Garcia', 'Daniel Brown',
      'Jennifer Davis', 'Matthew Miller', 'Lauren Anderson', 'Andrew Taylor', 'Samantha White',
      'Joshua Moore', 'Elizabeth Jackson', 'Ryan Martin', 'Nicole Thomas', 'Brandon Harris',
      'Megan Turner', 'Kevin Scott', 'Rachel Green', 'Tyler Campbell', 'Stephanie Parker',
      'Justin Evans', 'Hannah Edwards', 'Austin Collins', 'Alexis Stewart', 'Jonathan Morris',
      'Kayla Rogers', 'Nathan Reed', 'Brittany Cooper', 'Jordan Bailey', 'Rebecca Richardson',
      'Dylan Cox', 'Amber Howard', 'Zachary Ward', 'Michelle Torres', 'Kyle Peterson',
      'Tiffany Gray', 'Eric Ramirez', 'Courtney James', 'Sean Watson', 'Danielle Brooks',
      'Brian Kelly', 'Heather Sanders', 'Adam Price', 'Kimberly Bennett', 'Jacob Wood',
      'Melissa Barnes', 'Steven Ross', 'Christina Henderson', 'Alexander Coleman', 'Laura Jenkins',
      'Benjamin Perry', 'Maria Powell', 'Nicholas Long', 'Kelly Patterson', 'Richard Hughes',
      'Samantha Flores', 'Joseph Washington', 'Angela Butler', 'Charles Simmons', 'Lisa Foster',
      'Patrick Gonzales', 'Anna Bryant', 'Thomas Alexander', 'Catherine Russell', 'Ian Griffin',
      'Julia Hayes', 'Timothy Myers', 'Victoria Ford', 'George Hamilton', 'Natalie Graham',
      'Kenneth Sullivan', 'Olivia Wallace', 'Ronald Woods', 'Grace Cole', 'Edward West',
      'Sophia Jordan', 'Donald Owens', 'Chloe Reynolds', 'Jason Fisher', 'Emma Ellis',
      'Gary Gibson', 'Ava McDonald', 'Jeffrey Cruz', 'Isabella Marshall', 'Larry Ortiz',
      'Abigail Gomez', 'Dennis Murray', 'Madison Freeman', 'Frank Wells', 'Lily Webb',
      'Raymond Simpson', 'Ella Stevens', 'Jerry Tucker', 'Charlotte Porter', 'Carl Hunter',
      'Zoe Hicks', 'Peter Crawford', 'Layla Henry', 'Arthur Boyd', 'Nora Mason',
      'Douglas Morales', 'Hazel Kennedy', 'Henry Warren', 'Scarlett Dixon', 'Eugene Arnold',
      'Violet Marshall', 'Albert Lawson', 'Aurora Nguyen', 'Roger Mendoza', 'Penelope Fuller',
      'Keith Caldwell', 'Eleanor Vasquez', 'Russell Nichols', 'Maya Shaw', 'Philip Holland',
      'Savannah Hopkins', 'Lawrence Rice', 'Brooklyn Robertson', 'Gerald Hunt', 'Audrey Black',
      'Walter Armstrong', 'Claire Daniels', 'Harold Palmer', 'Lucy Rivera', 'Willie Bradley',
      'Addison Grant', 'Howard Guerrero', 'Lillian Harper', 'Terry Carlson', 'Stella Chapman',
      'Arthur Castro', 'Paisley Newman', 'Ralph Hart', 'Skylar Bowman', 'Louis Ramos',
      'Genesis Pearson', 'Roy Rhodes', 'Naomi Fleming', 'Eugene Bishop', 'Alice Mann',
      'Harry Reid', 'Ellie Reeves', 'Vincent Burke', 'Sophie Bates', 'Jack Lamb',
      'Arianna Barton', 'Bobby Fernandez', 'Sarah Curry', 'Gerald Guzman', 'Bella Castro',
      'Ralph Watts', 'Luna Lawson', 'Wayne Delgado', 'Leah Patton', 'Jesse Maxwell',
      'Caroline Lucas', 'Russell Chambers', 'Gabriella Parsons', 'Craig Bryan', 'Valentina Barker',
      'Victor Cortez', 'Anna Mendez', 'Louis Aguilar', 'Josephine Bowers', 'Bruce Valdez',
      'Kinsley Carson', 'Johnny Walsh', 'Madelyn Lyons', 'Philip Stokes', 'Kennedy Quinn',
      'Billy Curtis', 'Aaliyah Wade', 'Joe Reeves', 'Delilah Moran', 'Alan Conley'
    ];

    // First, seed 20 users as contacts
    const insertContact = this.db.prepare(`
      INSERT INTO contacts (userId, name, avatar, status, lastSeen, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const statuses = ['Available', 'Busy', 'Away', 'In a meeting', null, null, null]; // More nulls for variety

    for (let i = 0; i < userNames.length; i++) {
      const userId = `user_${i + 1}`;
      const name = userNames[i];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const lastSeen = now - Math.floor(Math.random() * 86400000); // Random within last 24 hours

      insertContact.run(userId, name, null, status, lastSeen, now);
    }

    console.log(`Seeded ${userNames.length} contacts`);

    const insertChat = this.db.prepare(`
      INSERT INTO chats (title, lastMessageAt, unreadCount)
      VALUES (?, ?, ?)
    `);

    for (let i = 0; i < userNames.length; i++) {
      const timestamp = now - (i * 60000);
      const chatName = userNames[i];
      const result = insertChat.run(chatName, timestamp, 0);
      chatIds.push(result.lastInsertRowid as number);
    }

    console.log(`Created ${chatIds.length} chats`);


    // Create 20,000+ messages distributed across chats
    const insertMessage = this.db.prepare(`
      INSERT INTO messages (chatId, ts, sender, body)
      VALUES (?, ?, ?, ?)
    `);

    const messageTemplates = [
      'Hey! How are you doing?',
      'Can we meet up tomorrow?',
      'I just sent you the document.',
      'Thanks so much for your help!',
      'Let me know what you think about this.',
      'This is an important update.',
      'Could you review the attached file?',
      'Great work on the project!',
      'I have a quick question...',
      'See you later!',
      'That sounds perfect!',
      'I agree with your point.',
      'Let me check on that.',
      'Will do, thanks!',
      'Perfect timing!',
      'I was just thinking about that.',
      'Absolutely! Count me in.',
      'I\'ll get back to you soon.',
      'That makes sense.',
      'Good idea!',
      'I\'m on my way.',
      'Almost there!',
      'Sorry for the delay.',
      'No problem at all!',
      'Happy to help!',
      'Looking forward to it.',
      'Sounds good to me.',
      'I\'ll take care of it.',
      'Let\'s do it!',
      'Noted, thanks!'
    ];

    // Keep track of chat names for message creation
    const chatNames = chatIds.map((_, idx) => userNames[idx % userNames.length]);

    // Use a transaction for better performance
    const insertMany = this.db.transaction(() => {
      let messageCount = 0;

      // Create 100 messages per chat to reach 20,000+ total messages (200 chats * 100 = 20,000)
      for (let chatIdx = 0; chatIdx < chatIds.length; chatIdx++) {
        const chatId = chatIds[chatIdx];
        const chatName = chatNames[chatIdx];
        const numMessages = 100;

        for (let msgIdx = 0; msgIdx < numMessages; msgIdx++) {
          const sender = msgIdx % 2 === 0 ? chatName : 'Me';
          const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
          const timestamp = now - (chatIdx * 60000) + (msgIdx * 1000);

          insertMessage.run(chatId, timestamp, sender, template);
          messageCount++;
        }
      }

      console.log(`Created ${messageCount} messages`);
    });

    insertMany();

    // Update lastMessageAt for all chats based on their actual last message
    this.db.exec(`
      UPDATE chats
      SET lastMessageAt = (
        SELECT MAX(ts)
        FROM messages
        WHERE messages.chatId = chats.id
      ),
      unreadCount = 0
    `);

    console.log('Database seeded successfully');
  }

  // ===========================
  // User Settings Methods
  // ===========================

  getUserSetting(key: string): UserSetting | null {
    const stmt = this.db.prepare('SELECT * FROM user_settings WHERE key = ?');
    return stmt.get(key) as UserSetting | undefined || null;
  }

  setUserSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO user_settings (key, value, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = ?,
        updatedAt = ?
    `);
    const now = Date.now();
    stmt.run(key, value, now, value, now);
  }

  deleteUserSetting(key: string): boolean {
    const stmt = this.db.prepare('DELETE FROM user_settings WHERE key = ?');
    const result = stmt.run(key);
    return result.changes > 0;
  }

  getAllSettings(): UserSetting[] {
    const stmt = this.db.prepare('SELECT * FROM user_settings ORDER BY key');
    return stmt.all() as UserSetting[];
  }

  // ===========================
  // Keyboard Shortcuts Methods
  // ===========================

  getKeyboardShortcuts(): KeyboardShortcut[] {
    const setting = this.getUserSetting('keyboard_shortcuts');
    if (setting) {
      try {
        return JSON.parse(setting.value) as KeyboardShortcut[];
      } catch (error) {
        console.error('Failed to parse keyboard shortcuts:', error);
        return this.getDefaultKeyboardShortcuts();
      }
    }
    return this.getDefaultKeyboardShortcuts();
  }

  setKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
    const value = JSON.stringify(shortcuts);
    this.setUserSetting('keyboard_shortcuts', value);
  }

  resetKeyboardShortcuts(): KeyboardShortcut[] {
    const defaults = this.getDefaultKeyboardShortcuts();
    this.setKeyboardShortcuts(defaults);
    return defaults;
  }

  private getDefaultKeyboardShortcuts(): KeyboardShortcut[] {
    return [
      { action: 'send-message', key: 'Enter', modifiers: [], description: 'Send message' },
      { action: 'new-line', key: 'Enter', modifiers: ['Shift'], description: 'New line in message' },
      { action: 'search', key: 'k', modifiers: ['Ctrl'], description: 'Search messages' },
      { action: 'search', key: 'k', modifiers: ['Meta'], description: 'Search messages (Mac)' },
      { action: 'toggle-search', key: 'f', modifiers: ['Ctrl'], description: 'Toggle search panel' },
      { action: 'toggle-search', key: 'f', modifiers: ['Meta'], description: 'Toggle search panel (Mac)' },
      { action: 'edit-last-message', key: 'ArrowUp', modifiers: [], description: 'Edit last message (when input empty)' },
      { action: 'cancel', key: 'Escape', modifiers: [], description: 'Cancel reply/edit/search' },
      { action: 'pin-message', key: 'p', modifiers: ['Ctrl'], description: 'Pin selected message' },
      { action: 'pin-message', key: 'p', modifiers: ['Meta'], description: 'Pin selected message (Mac)' },
      { action: 'export-chat', key: 'e', modifiers: ['Ctrl', 'Shift'], description: 'Export current chat' },
      { action: 'export-chat', key: 'e', modifiers: ['Meta', 'Shift'], description: 'Export current chat (Mac)' },
      { action: 'navigate-up', key: 'ArrowUp', modifiers: ['Alt'], description: 'Navigate to previous message' },
      { action: 'navigate-down', key: 'ArrowDown', modifiers: ['Alt'], description: 'Navigate to next message' },
      { action: 'reply', key: 'r', modifiers: ['Ctrl'], description: 'Reply to selected message' },
      { action: 'reply', key: 'r', modifiers: ['Meta'], description: 'Reply to selected message (Mac)' },
      { action: 'delete-message', key: 'Delete', modifiers: ['Ctrl'], description: 'Delete selected message' },
      { action: 'delete-message', key: 'Backspace', modifiers: ['Meta'], description: 'Delete selected message (Mac)' },
      { action: 'show-shortcuts', key: '/', modifiers: ['Ctrl'], description: 'Show keyboard shortcuts' },
      { action: 'show-shortcuts', key: '/', modifiers: ['Meta'], description: 'Show keyboard shortcuts (Mac)' }
    ];
  }

  // ===========================
  // Notification Settings Methods
  // ===========================

  getNotificationSound(chatId?: number): string | null {
    const key = chatId ? `notification_sound_${chatId}` : 'notification_sound_default';
    const setting = this.getUserSetting(key);
    return setting?.value || null;
  }

  setNotificationSound(chatId: number | null, soundId: string): void {
    const key = chatId ? `notification_sound_${chatId}` : 'notification_sound_default';
    this.setUserSetting(key, soundId);
  }

  deleteNotificationSound(chatId?: number): boolean {
    const key = chatId ? `notification_sound_${chatId}` : 'notification_sound_default';
    return this.deleteUserSetting(key);
  }

  // ===========================
  // Calls (WebRTC) Methods
  // ===========================

  createCall(id: string, chatId: number, type: 'audio' | 'video', initiatedBy: string): string {
    const stmt = this.db.prepare(`
      INSERT INTO calls (id, chatId, type, initiatedBy, startedAt, status)
      VALUES (?, ?, ?, ?, ?, 'ringing')
    `);
    stmt.run(id, chatId, type, initiatedBy, Date.now());
    return id;
  }

  getCall(callId: string): Call | null {
    const stmt = this.db.prepare('SELECT * FROM calls WHERE id = ?');
    return stmt.get(callId) as Call | undefined || null;
  }

  getCallsByChat(chatId: number, limit: number = 50): Call[] {
    const stmt = this.db.prepare(`
      SELECT * FROM calls
      WHERE chatId = ?
      ORDER BY startedAt DESC
      LIMIT ?
    `);
    return stmt.all(chatId, limit) as Call[];
  }

  getActiveCall(chatId: number): Call | null {
    const stmt = this.db.prepare(`
      SELECT * FROM calls
      WHERE chatId = ? AND status IN ('ringing', 'active')
      ORDER BY startedAt DESC
      LIMIT 1
    `);
    return stmt.get(chatId) as Call | undefined || null;
  }

  updateCallStatus(callId: string, status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined'): void {
    const stmt = this.db.prepare('UPDATE calls SET status = ? WHERE id = ?');
    stmt.run(status, callId);
  }

  endCall(callId: string): void {
    const stmt = this.db.prepare(`
      UPDATE calls
      SET status = 'ended', endedAt = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), callId);
  }

  declineCall(callId: string): void {
    const stmt = this.db.prepare(`
      UPDATE calls
      SET status = 'declined', endedAt = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), callId);
  }

  markCallMissed(callId: string): void {
    const stmt = this.db.prepare(`
      UPDATE calls
      SET status = 'missed', endedAt = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), callId);
  }

  // Call Participants

  addCallParticipant(callId: string, userId: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO call_participants (callId, userId, joinedAt)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(callId, userId, Date.now());
    return result.lastInsertRowid as number;
  }

  removeCallParticipant(callId: string, userId: string): void {
    const stmt = this.db.prepare(`
      UPDATE call_participants
      SET leftAt = ?
      WHERE callId = ? AND userId = ? AND leftAt IS NULL
    `);
    stmt.run(Date.now(), callId, userId);
  }

  getCallParticipants(callId: string): CallParticipant[] {
    const stmt = this.db.prepare('SELECT * FROM call_participants WHERE callId = ?');
    return stmt.all(callId) as CallParticipant[];
  }

  getActiveCallParticipants(callId: string): CallParticipant[] {
    const stmt = this.db.prepare(`
      SELECT * FROM call_participants
      WHERE callId = ? AND leftAt IS NULL
    `);
    return stmt.all(callId) as CallParticipant[];
  }

  // ==================== Authentication Methods ====================

  /**
   * Hash a password using PBKDF2
   */
  /**
   * Hash a password using Argon2id (recommended) or PBKDF2 600k (fallback)
   * Format: argon2id$<hash> or pbkdf2$<salt>:<hash>
   */
  private async hashPassword(password: string): Promise<string> {
    try {
      // Use Argon2id (OWASP recommended)
      const argon2 = require('argon2');
      const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 4
      });
      return `argon2id$${hash}`;
    } catch (error) {
      // Fallback to PBKDF2 with 600k iterations
      console.warn('[Database] Argon2id not available, falling back to PBKDF2 600k');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 600000, 64, 'sha512').toString('hex');
      return `pbkdf2$${salt}:${hash}`;
    }
  }

  /**
   * Verify a password against a hash
   * Supports both Argon2id and PBKDF2 formats
   */
  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    try {
      // Check format
      if (storedHash.startsWith('argon2id$')) {
        // Argon2id format
        const hash = storedHash.substring(9); // Remove 'argon2id$' prefix
        const argon2 = require('argon2');
        return await argon2.verify(hash, password);
      } else if (storedHash.startsWith('pbkdf2$')) {
        // New PBKDF2 600k format
        const hashPart = storedHash.substring(7); // Remove 'pbkdf2$' prefix
        const [salt, hash] = hashPart.split(':');
        if (!salt || !hash) return false;
        const verifyHash = crypto.pbkdf2Sync(password, salt, 600000, 64, 'sha512').toString('hex');
        // Timing-safe comparison to prevent timing attacks
        return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
      } else {
        // Legacy format (old PBKDF2 100k) - still support for backward compatibility
        const [salt, hash] = storedHash.split(':');
        if (!salt || !hash) return false;
        const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        // Timing-safe comparison
        return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
      }
    } catch (error) {
      console.error('[Database] Password verification failed:', error);
      return false;
    }
  }

  /**
   * Generate a secure random session token
   */
  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new user account
   */
  async createUser(username: string, password: string, email?: string, displayName?: string): Promise<number> {
    const passwordHash = await this.hashPassword(password);
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO users (username, passwordHash, email, displayName, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(username, passwordHash, email || null, displayName || null, now);
    return result.lastInsertRowid as number;
  }

  /**
   * Verify user credentials and return user if valid
   */
  async verifyCredentials(username: string, password: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username) as User | undefined;

    if (!user) return null;

    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) return null;

    // Update last login time
    const updateStmt = this.db.prepare('UPDATE users SET lastLoginAt = ? WHERE id = ?');
    updateStmt.run(Date.now(), user.id);

    return user;
  }

  /**
   * Get user by ID
   */
  getUserById(userId: number): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(userId) as User | undefined;
  }

  /**
   * Get user by username
   */
  getUserByUsername(username: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | undefined;
  }

  /**
   * Create a new session for a user
   */
  createSession(userId: number, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): Session {
    const sessionId = crypto.randomUUID();
    const token = this.generateSessionToken();
    const now = Date.now();
    const expiresAt = now + expiresInMs;

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, userId, token, createdAt, expiresAt, lastActivityAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(sessionId, userId, token, now, expiresAt, now);

    return {
      id: sessionId,
      userId,
      token,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
    };
  }

  /**
   * Validate a session token and return the session if valid
   */
  validateSession(token: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions
      WHERE token = ? AND expiresAt > ?
    `);
    const session = stmt.get(token, Date.now()) as Session | undefined;

    if (!session) return null;

    // Update last activity time
    const updateStmt = this.db.prepare(`
      UPDATE sessions
      SET lastActivityAt = ?
      WHERE id = ?
    `);
    updateStmt.run(Date.now(), session.id);

    return session;
  }

  /**
   * Destroy a session (logout)
   */
  destroySession(token: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE token = ?');
    stmt.run(token);
  }

  /**
   * Destroy all sessions for a user
   */
  destroyAllUserSessions(userId: number): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE userId = ?');
    stmt.run(userId);
  }

  /**
   * Clean up expired sessions (should be run periodically)
   */
  cleanupExpiredSessions(): number {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE expiresAt <= ?');
    const result = stmt.run(Date.now());
    return result.changes;
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: number): Session[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions
      WHERE userId = ? AND expiresAt > ?
      ORDER BY lastActivityAt DESC
    `);
    return stmt.all(userId, Date.now()) as Session[];
  }

  close() {
    this.db.close();
  }

  // Get database statistics
  getStats() {
    const chatCount = this.db.prepare('SELECT COUNT(*) as count FROM chats').get() as { count: number };
    const messageCount = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
    return { chats: chatCount.count, messages: messageCount.count };
  }
}
