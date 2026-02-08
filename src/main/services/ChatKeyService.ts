import * as crypto from 'crypto';

export interface ChatKeys {
  chatId: number;
  encryptionKey: Buffer;
  hmacKey: Buffer;
  version: number;
  createdAt: number;
  lastRotatedAt: number;
}

interface EncryptedChatKeys {
  chatId: number;
  encryptedData: string; // IV:authTag:encrypted(encryptionKey + hmacKey)
  version: number;
  createdAt: number;
  lastRotatedAt: number;
}

export class ChatKeyService {
  private readonly ENCRYPTION_KEY_LENGTH = 32; // 256 bits for AES-256
  private readonly HMAC_KEY_LENGTH = 32; // 256 bits for HMAC-SHA256
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 12;
  private readonly KEY_ROTATION_DAYS = 30;

  // In-memory cache of decrypted chat keys
  private keyCache: Map<number, ChatKeys> = new Map();

  /**
   * Generates new encryption and HMAC keys for a chat
   * @param chatId Chat identifier
   * @param masterKey Master key to encrypt the chat keys
   * @returns Encrypted chat keys ready to store in database
   */
  async generateChatKeys(chatId: number, masterKey: Buffer): Promise<EncryptedChatKeys> {
    // Generate random keys
    const encryptionKey = crypto.randomBytes(this.ENCRYPTION_KEY_LENGTH);
    const hmacKey = crypto.randomBytes(this.HMAC_KEY_LENGTH);

    const chatKeys: ChatKeys = {
      chatId,
      encryptionKey,
      hmacKey,
      version: 1,
      createdAt: Date.now(),
      lastRotatedAt: Date.now()
    };

    // Encrypt the keys with master key
    const encryptedData = this.encryptKeys(chatKeys, masterKey);

    // Cache in memory
    this.keyCache.set(chatId, chatKeys);

    console.log(`[ChatKeys] Generated new keys for chat ${chatId}`);

    return {
      chatId,
      encryptedData,
      version: chatKeys.version,
      createdAt: chatKeys.createdAt,
      lastRotatedAt: chatKeys.lastRotatedAt
    };
  }

  /**
   * Retrieves chat keys (from cache or by decrypting with master key)
   * @param chatId Chat identifier
   * @param encryptedData Encrypted chat keys from database
   * @param masterKey Master key to decrypt the chat keys
   * @returns Decrypted chat keys
   */
  async getChatKeys(
    chatId: number,
    encryptedData: string,
    masterKey: Buffer
  ): Promise<ChatKeys> {
    // Check cache first
    if (this.keyCache.has(chatId)) {
      return this.keyCache.get(chatId)!;
    }

    // Decrypt from database
    const chatKeys = this.decryptKeys(chatId, encryptedData, masterKey);

    // Cache in memory
    this.keyCache.set(chatId, chatKeys);

    return chatKeys;
  }

  /**
   * Rotates chat keys (generates new keys, keeps old version for migration)
   * @param chatId Chat identifier
   * @param oldEncryptedData Current encrypted keys
   * @param masterKey Master key
   * @returns New encrypted chat keys
   */
  async rotateChatKeys(
    chatId: number,
    oldEncryptedData: string,
    masterKey: Buffer
  ): Promise<EncryptedChatKeys> {
    // Get current keys
    const oldKeys = await this.getChatKeys(chatId, oldEncryptedData, masterKey);

    // Generate new keys
    const encryptionKey = crypto.randomBytes(this.ENCRYPTION_KEY_LENGTH);
    const hmacKey = crypto.randomBytes(this.HMAC_KEY_LENGTH);

    const newKeys: ChatKeys = {
      chatId,
      encryptionKey,
      hmacKey,
      version: oldKeys.version + 1,
      createdAt: oldKeys.createdAt,
      lastRotatedAt: Date.now()
    };

    // Encrypt new keys
    const encryptedData = this.encryptKeys(newKeys, masterKey);

    // Update cache
    this.keyCache.set(chatId, newKeys);

    // Wipe old keys from memory
    this.wipeKeys(oldKeys);

    console.log(`[ChatKeys] Rotated keys for chat ${chatId} to version ${newKeys.version}`);

    return {
      chatId,
      encryptedData,
      version: newKeys.version,
      createdAt: newKeys.createdAt,
      lastRotatedAt: newKeys.lastRotatedAt
    };
  }

  /**
   * Checks if chat keys need rotation (older than 30 days)
   * @param lastRotatedAt Timestamp of last rotation
   * @returns True if rotation is needed
   */
  needsRotation(lastRotatedAt: number): boolean {
    const daysSinceRotation = (Date.now() - lastRotatedAt) / (1000 * 60 * 60 * 24);
    return daysSinceRotation >= this.KEY_ROTATION_DAYS;
  }

  /**
   * Encrypts chat keys with master key
   * @param chatKeys Chat keys to encrypt
   * @param masterKey Master key
   * @returns Encrypted data in format IV:authTag:ciphertext
   */
  private encryptKeys(chatKeys: ChatKeys, masterKey: Buffer): string {
    // Combine keys into single buffer with metadata
    const keysData = JSON.stringify({
      encryptionKey: chatKeys.encryptionKey.toString('hex'),
      hmacKey: chatKeys.hmacKey.toString('hex'),
      version: chatKeys.version,
      createdAt: chatKeys.createdAt,
      lastRotatedAt: chatKeys.lastRotatedAt
    });

    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, masterKey, iv);

    let encrypted = cipher.update(keysData, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts chat keys with master key
   * @param chatId Chat identifier
   * @param encryptedData Encrypted keys from database
   * @param masterKey Master key
   * @returns Decrypted chat keys
   */
  private decryptKeys(chatId: number, encryptedData: string, masterKey: Buffer): ChatKeys {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted chat keys format');
      }

      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.ALGORITHM, masterKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const data = JSON.parse(decrypted);

      return {
        chatId,
        encryptionKey: Buffer.from(data.encryptionKey, 'hex'),
        hmacKey: Buffer.from(data.hmacKey, 'hex'),
        version: data.version,
        createdAt: data.createdAt,
        lastRotatedAt: data.lastRotatedAt
      };
    } catch (error) {
      console.error(`[ChatKeys] Failed to decrypt keys for chat ${chatId}:`, error);
      throw new Error('Failed to decrypt chat keys');
    }
  }

  /**
   * Wipes sensitive key data from memory
   * @param chatKeys Keys to wipe
   */
  private wipeKeys(chatKeys: ChatKeys): void {
    chatKeys.encryptionKey.fill(0);
    chatKeys.hmacKey.fill(0);
  }

  /**
   * Removes chat keys from cache
   * @param chatId Chat identifier
   */
  clearChatKeysFromCache(chatId: number): void {
    const keys = this.keyCache.get(chatId);
    if (keys) {
      this.wipeKeys(keys);
      this.keyCache.delete(chatId);
    }
  }

  /**
   * Clears all cached keys
   */
  clearAllCachedKeys(): void {
    for (const [chatId, keys] of this.keyCache.entries()) {
      this.wipeKeys(keys);
    }
    this.keyCache.clear();
    console.log('[ChatKeys] All cached keys cleared');
  }

  /**
   * Gets cache statistics for monitoring
   */
  getCacheStats(): { cachedChats: number; totalSize: number } {
    return {
      cachedChats: this.keyCache.size,
      totalSize: this.keyCache.size * (this.ENCRYPTION_KEY_LENGTH + this.HMAC_KEY_LENGTH)
    };
  }

  /**
   * Re-encrypts chat keys with a new master key (for password change)
   * @param chatId Chat identifier
   * @param oldEncryptedData Current encrypted keys
   * @param oldMasterKey Old master key
   * @param newMasterKey New master key
   * @returns Newly encrypted chat keys
   */
  async reencryptChatKeys(
    chatId: number,
    oldEncryptedData: string,
    oldMasterKey: Buffer,
    newMasterKey: Buffer
  ): Promise<EncryptedChatKeys> {
    // Decrypt with old key
    const chatKeys = this.decryptKeys(chatId, oldEncryptedData, oldMasterKey);

    // Re-encrypt with new key
    const encryptedData = this.encryptKeys(chatKeys, newMasterKey);

    console.log(`[ChatKeys] Re-encrypted keys for chat ${chatId} with new master key`);

    return {
      chatId,
      encryptedData,
      version: chatKeys.version,
      createdAt: chatKeys.createdAt,
      lastRotatedAt: chatKeys.lastRotatedAt
    };
  }
}

// Export singleton instance
export const chatKeyService = new ChatKeyService();
