import * as crypto from 'crypto';
import { keyManagementService } from './KeyManagementService';
import { chatKeyService, ChatKeys } from './ChatKeyService';

export class SecurityService {
  private isInitialized = false;
  private masterKey: Buffer | null = null;
  private currentUserId: string | null = null;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 12;
  private readonly AUTH_TAG_LENGTH = 16;
  private readonly KEY_LENGTH = 32;

  async initialize(): Promise<void> {
    // Legacy initialize - generates random key (not persistent)
    // Only used for backward compatibility or testing
    if (!this.masterKey) {
      this.masterKey = crypto.randomBytes(this.KEY_LENGTH);
      console.warn('[Security] Using non-persistent random master key. For production, use initializeForUser()');
    }
    this.isInitialized = true;
    console.log('[Security] Service initialized with AES-256-GCM encryption');
  }

  /**
   * Initialize security for a specific user with persistent key management
   * @param userId User identifier
   * @param password User's password (used to derive key if not in keychain)
   * @returns True if successful
   */
  async initializeForUser(userId: string, password: string): Promise<boolean> {
    try {
      this.currentUserId = userId;

      // Try to retrieve existing master key from keychain
      let masterKey = await keyManagementService.retrieveMasterKey(userId);

      if (!masterKey) {
        // No key exists - derive from password and store
        console.log('[Security] No existing key found, deriving from password with Argon2id');

        // Check if we have a stored salt
        let salt = await keyManagementService.retrieveSalt(userId);

        if (!salt) {
          // First time setup - generate new salt and derive key with Argon2id
          const { key, salt: newSalt } = await keyManagementService.deriveKeyFromPasswordAsync(password);
          await keyManagementService.storeMasterKey(userId, key, newSalt);
          masterKey = key;
          console.log('[Security] New master key generated and stored using Argon2id');
        } else {
          // Salt exists - derive key with existing salt using Argon2id
          const { key } = await keyManagementService.deriveKeyFromPasswordAsync(password, salt);
          await keyManagementService.storeMasterKey(userId, key, salt);
          masterKey = key;
          console.log('[Security] Master key derived from password with existing salt using Argon2id');
        }
      } else {
        console.log('[Security] Master key retrieved from keychain');
      }

      this.masterKey = masterKey;
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[Security] Failed to initialize for user:', error);
      this.isInitialized = false;
      return false;
    }
  }

  setMasterKeyFromPassword(password: string, salt: string): void {
    // Legacy method - now uses KeyManagementService with improved iterations
    const { key } = keyManagementService.deriveKeyFromPassword(password, salt);
    this.masterKey = key;
    console.log('[Security] Master key derived from password (600k iterations)');
  }

  setMasterKey(key: Buffer): void {
    if (key.length !== this.KEY_LENGTH) {
      throw new Error(`Master key must be ${this.KEY_LENGTH} bytes`);
    }
    this.masterKey = key;
  }

  getMasterKey(): Buffer | null {
    return this.masterKey;
  }

  encrypt(plaintext: string, recipientId: string = 'default'): string {
    if (!this.masterKey) {
      throw new Error('SecurityService not initialized. Call initialize() first.');
    }

    try {
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(this.ALGORITHM, this.masterKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('[Security] Encryption failed:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  decrypt(ciphertext: string, senderId: string = 'default'): string {
    if (!this.masterKey) {
      throw new Error('SecurityService not initialized. Call initialize() first.');
    }

    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted message format');
      }

      const [ivHex, authTagHex, encryptedHex] = parts;

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      if (iv.length !== this.IV_LENGTH) {
        throw new Error('Invalid IV length');
      }
      if (authTag.length !== this.AUTH_TAG_LENGTH) {
        throw new Error('Invalid auth tag length');
      }

      const decipher = crypto.createDecipheriv(this.ALGORITHM, this.masterKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[Security] Decryption failed:', error);
      throw new Error('Failed to decrypt message - data may be corrupted or tampered with');
    }
  }

  isEncrypted(data: string): boolean {
    const parts = data.split(':');
    if (parts.length !== 3) return false;

    const [ivHex, authTagHex, ciphertext] = parts;

    const ivBytes = ivHex.length / 2;
    const authTagBytes = authTagHex.length / 2;

    return (
      ivBytes === this.IV_LENGTH &&
      authTagBytes === this.AUTH_TAG_LENGTH &&
      /^[0-9a-f]+$/i.test(ivHex) &&
      /^[0-9a-f]+$/i.test(authTagHex) &&
      /^[0-9a-f]+$/i.test(ciphertext)
    );
  }

  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  sanitizeForLogging(data: any): any {
    if (typeof data === 'string') {
      if (this.isEncrypted(data)) {
        return '[ENCRYPTED]';
      }
      return '[REDACTED]';
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const key in data) {
        if (['body', 'message', 'content', 'password', 'token', 'key', 'secret'].includes(key.toLowerCase())) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeForLogging(data[key]);
        }
      }
      return sanitized;
    }

    return data;
  }

  wipe(buffer: Buffer): void {
    if (buffer && Buffer.isBuffer(buffer)) {
      buffer.fill(0);
    }
  }

  // ============================================================================
  // Per-Chat Encryption Methods
  // ============================================================================

  /**
   * Encrypts plaintext for a specific chat using per-chat keys
   * @param chatId Chat identifier
   * @param plaintext Text to encrypt
   * @param chatKeys Chat-specific encryption keys
   * @returns Encrypted text with HMAC
   */
  encryptForChat(chatId: number, plaintext: string, chatKeys: ChatKeys): string {
    if (!chatKeys) {
      throw new Error(`No encryption keys available for chat ${chatId}`);
    }

    try {
      // Encrypt with chat's encryption key
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(this.ALGORITHM, chatKeys.encryptionKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Add HMAC for additional integrity check
      const hmac = crypto.createHmac('sha256', chatKeys.hmacKey);
      hmac.update(iv);
      hmac.update(authTag);
      hmac.update(Buffer.from(encrypted, 'hex'));
      const hmacDigest = hmac.digest('hex');

      // Format: IV:authTag:encrypted:hmac
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}:${hmacDigest}`;
    } catch (error) {
      console.error(`[Security] Encryption failed for chat ${chatId}:`, error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * Decrypts ciphertext for a specific chat using per-chat keys
   * @param chatId Chat identifier
   * @param ciphertext Encrypted text
   * @param chatKeys Chat-specific encryption keys
   * @returns Decrypted plaintext
   */
  decryptForChat(chatId: number, ciphertext: string, chatKeys: ChatKeys): string {
    if (!chatKeys) {
      throw new Error(`No encryption keys available for chat ${chatId}`);
    }

    try {
      const parts = ciphertext.split(':');

      // Support both old format (3 parts) and new format (4 parts with HMAC)
      if (parts.length !== 3 && parts.length !== 4) {
        throw new Error('Invalid encrypted message format');
      }

      const [ivHex, authTagHex, encryptedHex, hmacHex] = parts;

      // Verify HMAC if present
      if (hmacHex) {
        const hmac = crypto.createHmac('sha256', chatKeys.hmacKey);
        hmac.update(Buffer.from(ivHex, 'hex'));
        hmac.update(Buffer.from(authTagHex, 'hex'));
        hmac.update(Buffer.from(encryptedHex, 'hex'));
        const expectedHmac = hmac.digest('hex');

        if (expectedHmac !== hmacHex) {
          throw new Error('HMAC verification failed - message may be tampered');
        }
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      if (iv.length !== this.IV_LENGTH) {
        throw new Error('Invalid IV length');
      }
      if (authTag.length !== this.AUTH_TAG_LENGTH) {
        throw new Error('Invalid auth tag length');
      }

      const decipher = crypto.createDecipheriv(this.ALGORITHM, chatKeys.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error(`[Security] Decryption failed for chat ${chatId}:`, error);
      throw new Error('Failed to decrypt message - data may be corrupted or tampered with');
    }
  }

  /**
   * Initializes encryption keys for a new chat
   * @param chatId Chat identifier
   * @returns Encrypted chat keys ready to store
   */
  async initializeChatKeys(chatId: number): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    const encryptedKeys = await chatKeyService.generateChatKeys(chatId, this.masterKey);
    return encryptedKeys.encryptedData;
  }

  /**
   * Gets decrypted chat keys from encrypted storage
   * @param chatId Chat identifier
   * @param encryptedData Encrypted keys from database
   * @returns Decrypted chat keys
   */
  async getChatKeys(chatId: number, encryptedData: string): Promise<ChatKeys> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    return await chatKeyService.getChatKeys(chatId, encryptedData, this.masterKey);
  }

  /**
   * Rotates chat keys (generates new keys)
   * @param chatId Chat identifier
   * @param oldEncryptedData Current encrypted keys
   * @returns New encrypted chat keys
   */
  async rotateChatKeys(chatId: number, oldEncryptedData: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Master key not initialized');
    }

    const newKeys = await chatKeyService.rotateChatKeys(chatId, oldEncryptedData, this.masterKey);
    return newKeys.encryptedData;
  }

  /**
   * Checks if chat keys need rotation
   * @param lastRotatedAt Timestamp of last rotation
   * @returns True if rotation needed
   */
  needsKeyRotation(lastRotatedAt: number): boolean {
    return chatKeyService.needsRotation(lastRotatedAt);
  }

  /**
   * Clears chat keys from cache
   * @param chatId Chat identifier
   */
  clearChatKeysCache(chatId: number): void {
    chatKeyService.clearChatKeysFromCache(chatId);
  }

  clearMasterKey(): void {
    if (this.masterKey) {
      this.wipe(this.masterKey);
      this.masterKey = null;
    }

    // Also clear from KeyManagementService memory (but keep in keychain)
    if (this.currentUserId) {
      keyManagementService.clearFromMemory(this.currentUserId);
    }

    this.isInitialized = false;
    this.currentUserId = null;
    console.log('[Security] Master key cleared from memory');
  }

  /**
   * Changes the master key after password change
   * NOTE: This requires re-encrypting all existing data with the new key
   * @param newPassword New password
   * @returns True if successful
   */
  async changeMasterKey(newPassword: string): Promise<boolean> {
    if (!this.currentUserId) {
      console.error('[Security] Cannot change master key: no user initialized');
      return false;
    }

    try {
      // Generate new master key
      const newMasterKey = await keyManagementService.changeMasterKey(
        this.currentUserId,
        newPassword
      );

      // Update in-memory key
      this.masterKey = newMasterKey;

      console.log('[Security] Master key changed successfully');
      console.warn('[Security] WARNING: All encrypted data must be re-encrypted with the new key');
      return true;
    } catch (error) {
      console.error('[Security] Failed to change master key:', error);
      return false;
    }
  }

  /**
   * Deletes the master key from keychain (e.g., on account deletion)
   */
  async deleteMasterKey(): Promise<void> {
    if (this.currentUserId) {
      await keyManagementService.deleteMasterKey(this.currentUserId);
      this.clearMasterKey();
      console.log('[Security] Master key deleted from keychain');
    }
  }

  /**
   * Gets the current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Checks if key exists in keychain for a user
   */
  async hasMasterKeyInKeychain(userId: string): Promise<boolean> {
    return await keyManagementService.hasMasterKey(userId);
  }
}

export const securityService = new SecurityService();
