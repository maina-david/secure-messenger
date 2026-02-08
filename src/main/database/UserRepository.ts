import * as crypto from 'crypto';
import { BaseRepository } from './BaseRepository';

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  email?: string;
  displayName?: string;
  createdAt: number;
  lastLoginAt?: number;
}

export interface Session {
  id: string;
  userId: number;
  token: string;
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
}

export class UserRepository extends BaseRepository {
  /**
   * Create a new user
   */
  async create(
    username: string,
    password: string,
    email?: string,
    displayName?: string
  ): Promise<number> {
    const passwordHash = await this.hashPassword(password);
    const now = Date.now();

    return this.insert('users', {
      username,
      passwordHash,
      email: email || null,
      displayName: displayName || null,
      createdAt: now
    });
  }

  /**
   * Get user by ID
   */
  getById(userId: number): User | undefined {
    const stmt = this.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(userId) as User | undefined;
  }

  /**
   * Get user by username
   */
  getByUsername(username: string): User | undefined {
    const stmt = this.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | undefined;
  }

  /**
   * Get user by email
   */
  getByEmail(email: string): User | undefined {
    const stmt = this.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | undefined;
  }

  /**
   * Verify user credentials
   */
  async verifyCredentials(username: string, password: string): Promise<User | null> {
    const user = this.getByUsername(username);
    if (!user) return null;

    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) return null;

    // Update last login time
    this.updateLastLogin(user.id);

    return user;
  }

  /**
   * Update last login timestamp
   */
  updateLastLogin(userId: number): boolean {
    const changes = this.update(
      'users',
      { lastLoginAt: Date.now() },
      'id = ?',
      userId
    );
    return changes > 0;
  }

  /**
   * Update user profile
   */
  updateProfile(userId: number, updates: {
    email?: string;
    displayName?: string;
  }): boolean {
    const changes = this.update('users', updates, 'id = ?', userId);
    return changes > 0;
  }

  /**
   * Update password
   */
  async updatePassword(userId: number, newPassword: string): Promise<boolean> {
    const passwordHash = await this.hashPassword(newPassword);
    const changes = this.update(
      'users',
      { passwordHash },
      'id = ?',
      userId
    );
    return changes > 0;
  }

  /**
   * Delete user
   */
  deleteUser(userId: number): boolean {
    const changes = this.delete('users', 'id = ?', userId);
    return changes > 0;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Create a new session
   */
  createSession(userId: number, durationMs: number = 7 * 24 * 60 * 60 * 1000): Session {
    const now = Date.now();
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      token: this.generateSessionToken(),
      createdAt: now,
      expiresAt: now + durationMs,
      lastActivityAt: now
    };

    this.insert('sessions', session);
    return session;
  }

  /**
   * Get session by token
   */
  getSessionByToken(token: string): Session | undefined {
    const stmt = this.prepare('SELECT * FROM sessions WHERE token = ?');
    return stmt.get(token) as Session | undefined;
  }

  /**
   * Validate session and update activity
   */
  validateSession(token: string): Session | null {
    const session = this.getSessionByToken(token);
    if (!session) return null;

    const now = Date.now();

    // Check if expired
    if (session.expiresAt < now) {
      this.destroySession(token);
      return null;
    }

    // Update last activity
    this.updateSessionActivity(token);

    return session;
  }

  /**
   * Update session activity timestamp
   */
  updateSessionActivity(token: string): boolean {
    const changes = this.update(
      'sessions',
      { lastActivityAt: Date.now() },
      'token = ?',
      token
    );
    return changes > 0;
  }

  /**
   * Destroy a session
   */
  destroySession(token: string): boolean {
    const changes = this.delete('sessions', 'token = ?', token);
    return changes > 0;
  }

  /**
   * Destroy all sessions for a user
   */
  destroyUserSessions(userId: number): number {
    return this.delete('sessions', 'userId = ?', userId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    return this.delete('sessions', 'expiresAt < ?', now);
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: number): Session[] {
    const now = Date.now();
    const stmt = this.prepare(`
      SELECT * FROM sessions
      WHERE userId = ? AND expiresAt > ?
      ORDER BY lastActivityAt DESC
    `);
    return stmt.all(userId, now) as Session[];
  }

  // ============================================================================
  // Password Hashing & Verification
  // ============================================================================

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
      console.warn('[UserRepository] Argon2id not available, falling back to PBKDF2 600k');
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
      console.error('[UserRepository] Password verification failed:', error);
      return false;
    }
  }

  /**
   * Generate a secure random session token
   */
  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}
