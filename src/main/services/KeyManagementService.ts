import * as crypto from 'crypto';
import * as keytar from 'keytar';
import * as argon2 from 'argon2';

interface KeyMetadata {
  userId: string;
  salt: string;
  createdAt: number;
  lastAccessedAt: number;
}

export class KeyManagementService {
  private readonly SERVICE_NAME = 'secure-messenger';
  private readonly KEY_DERIVATION_ITERATIONS = 600000; // PBKDF2 fallback
  private readonly AUTO_CLEAR_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  private readonly SALT_LENGTH = 32;

  // Argon2id parameters (OWASP recommended)
  private readonly ARGON2_MEMORY_COST = 65536; // 64 MB
  private readonly ARGON2_TIME_COST = 3; // 3 iterations
  private readonly ARGON2_PARALLELISM = 4; // 4 parallel threads

  private inMemoryKeys: Map<string, Buffer> = new Map();
  private autoClearTimers: Map<string, NodeJS.Timeout> = new Map();
  private metadata: Map<string, KeyMetadata> = new Map();

  /**
   * Derives a master key from a password using Argon2id (preferred) or PBKDF2 (fallback)
   * @param password User's password
   * @param salt Hex-encoded salt (generated if not provided)
   * @param useArgon2 Whether to use Argon2id (default: true)
   * @returns Object containing derived key and salt
   */
  deriveKeyFromPassword(
    password: string,
    salt?: string,
    useArgon2: boolean = true
  ): { key: Buffer; salt: string } {
    const saltBuffer = salt
      ? Buffer.from(salt, 'hex')
      : crypto.randomBytes(this.SALT_LENGTH);

    // Try Argon2id first (preferred)
    if (useArgon2) {
      try {
        const key = this.deriveKeyWithArgon2Sync(password, saltBuffer);
        return {
          key,
          salt: saltBuffer.toString('hex')
        };
      } catch (error) {
        console.warn('[KeyManagement] Argon2id failed, falling back to PBKDF2:', error);
      }
    }

    // Fallback to PBKDF2 (still strong with 600k iterations)
    const key = crypto.pbkdf2Sync(
      password,
      saltBuffer,
      this.KEY_DERIVATION_ITERATIONS,
      32, // 256 bits for AES-256
      'sha512'
    );

    return {
      key,
      salt: saltBuffer.toString('hex')
    };
  }

  /**
   * Derives a key using Argon2id (synchronously)
   * @param password User's password
   * @param saltBuffer Salt as Buffer
   * @returns Derived key as Buffer
   */
  private deriveKeyWithArgon2Sync(password: string, saltBuffer: Buffer): Buffer {
    // Note: argon2 only provides async API, but we can use it synchronously via a workaround
    // For true sync behavior, we'd need a different approach, but for now we'll keep the async
    throw new Error('Sync Argon2 not available, use deriveKeyWithArgon2Async');
  }

  /**
   * Derives a key using Argon2id (asynchronously, recommended)
   * @param password User's password
   * @param saltBuffer Salt as Buffer
   * @returns Promise of derived key as Buffer
   */
  async deriveKeyWithArgon2Async(password: string, saltBuffer: Buffer): Promise<Buffer> {
    try {
      const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: this.ARGON2_MEMORY_COST,
        timeCost: this.ARGON2_TIME_COST,
        parallelism: this.ARGON2_PARALLELISM,
        salt: saltBuffer,
        hashLength: 32, // 256 bits for AES-256
        raw: true // Return raw buffer instead of encoded string
      });

      return hash as Buffer;
    } catch (error) {
      console.error('[KeyManagement] Argon2id derivation failed:', error);
      throw error;
    }
  }

  /**
   * Derives a master key from a password using Argon2id (async version)
   * This is the recommended method for new implementations
   * @param password User's password
   * @param salt Hex-encoded salt (generated if not provided)
   * @returns Promise of object containing derived key and salt
   */
  async deriveKeyFromPasswordAsync(
    password: string,
    salt?: string
  ): Promise<{ key: Buffer; salt: string }> {
    const saltBuffer = salt
      ? Buffer.from(salt, 'hex')
      : crypto.randomBytes(this.SALT_LENGTH);

    try {
      // Use Argon2id (recommended)
      const key = await this.deriveKeyWithArgon2Async(password, saltBuffer);
      console.log('[KeyManagement] Key derived using Argon2id (recommended)');

      return {
        key,
        salt: saltBuffer.toString('hex')
      };
    } catch (error) {
      // Fallback to PBKDF2 if Argon2id fails
      console.warn('[KeyManagement] Argon2id failed, falling back to PBKDF2:', error);

      const key = crypto.pbkdf2Sync(
        password,
        saltBuffer,
        this.KEY_DERIVATION_ITERATIONS,
        32,
        'sha512'
      );

      return {
        key,
        salt: saltBuffer.toString('hex')
      };
    }
  }

  /**
   * Stores master key in OS keychain
   * @param userId User identifier
   * @param masterKey Master encryption key
   * @param salt Salt used for key derivation
   */
  async storeMasterKey(userId: string, masterKey: Buffer, salt: string): Promise<void> {
    try {
      const keyHex = masterKey.toString('hex');
      const accountName = `master-key_${userId}`;

      // Store the master key
      await keytar.setPassword(this.SERVICE_NAME, accountName, keyHex);

      // Store the salt separately
      await keytar.setPassword(this.SERVICE_NAME, `salt_${userId}`, salt);

      // Store metadata
      const metadata: KeyMetadata = {
        userId,
        salt,
        createdAt: Date.now(),
        lastAccessedAt: Date.now()
      };
      this.metadata.set(userId, metadata);

      // Keep in memory for performance
      this.inMemoryKeys.set(userId, masterKey);

      // Start auto-clear timer
      this.resetAutoClearTimer(userId);

      console.log(`[KeyManagement] Master key stored for user: ${userId}`);
    } catch (error) {
      console.error('[KeyManagement] Failed to store master key:', error);
      throw new Error('Failed to store master key in keychain');
    }
  }

  /**
   * Retrieves master key from OS keychain
   * @param userId User identifier
   * @returns Master key or null if not found
   */
  async retrieveMasterKey(userId: string): Promise<Buffer | null> {
    try {
      // Check in-memory cache first
      if (this.inMemoryKeys.has(userId)) {
        this.resetAutoClearTimer(userId);
        this.updateLastAccessed(userId);
        return this.inMemoryKeys.get(userId)!;
      }

      // Retrieve from keychain
      const accountName = `master-key_${userId}`;
      const keyHex = await keytar.getPassword(this.SERVICE_NAME, accountName);

      if (!keyHex) {
        console.log(`[KeyManagement] No master key found for user: ${userId}`);
        return null;
      }

      const masterKey = Buffer.from(keyHex, 'hex');

      // Cache in memory
      this.inMemoryKeys.set(userId, masterKey);
      this.resetAutoClearTimer(userId);
      this.updateLastAccessed(userId);

      console.log(`[KeyManagement] Master key retrieved for user: ${userId}`);
      return masterKey;
    } catch (error) {
      console.error('[KeyManagement] Failed to retrieve master key:', error);
      return null;
    }
  }

  /**
   * Retrieves salt for a user
   * @param userId User identifier
   * @returns Salt as hex string or null if not found
   */
  async retrieveSalt(userId: string): Promise<string | null> {
    try {
      const salt = await keytar.getPassword(this.SERVICE_NAME, `salt_${userId}`);
      return salt;
    } catch (error) {
      console.error('[KeyManagement] Failed to retrieve salt:', error);
      return null;
    }
  }

  /**
   * Deletes master key from OS keychain and memory
   * @param userId User identifier
   */
  async deleteMasterKey(userId: string): Promise<void> {
    try {
      const accountName = `master-key_${userId}`;

      // Remove from keychain
      await keytar.deletePassword(this.SERVICE_NAME, accountName);
      await keytar.deletePassword(this.SERVICE_NAME, `salt_${userId}`);

      // Clear from memory
      this.clearFromMemory(userId);

      console.log(`[KeyManagement] Master key deleted for user: ${userId}`);
    } catch (error) {
      console.error('[KeyManagement] Failed to delete master key:', error);
      throw new Error('Failed to delete master key from keychain');
    }
  }

  /**
   * Clears master key from memory (but keeps in keychain)
   * @param userId User identifier
   */
  clearFromMemory(userId: string): void {
    // Clear the key buffer
    const key = this.inMemoryKeys.get(userId);
    if (key) {
      key.fill(0); // Overwrite with zeros for security
      this.inMemoryKeys.delete(userId);
    }

    // Clear timer
    const timer = this.autoClearTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.autoClearTimers.delete(userId);
    }

    // Clear metadata
    this.metadata.delete(userId);

    console.log(`[KeyManagement] Master key cleared from memory for user: ${userId}`);
  }

  /**
   * Clears all keys from memory
   */
  clearAllFromMemory(): void {
    for (const userId of this.inMemoryKeys.keys()) {
      this.clearFromMemory(userId);
    }
    console.log('[KeyManagement] All keys cleared from memory');
  }

  /**
   * Resets the auto-clear timer for a user
   * @param userId User identifier
   */
  private resetAutoClearTimer(userId: string): void {
    // Clear existing timer
    const existingTimer = this.autoClearTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      console.log(`[KeyManagement] Auto-clearing key for user: ${userId} after inactivity`);
      this.clearFromMemory(userId);
    }, this.AUTO_CLEAR_TIMEOUT);

    this.autoClearTimers.set(userId, timer);
  }

  /**
   * Updates last accessed timestamp
   * @param userId User identifier
   */
  private updateLastAccessed(userId: string): void {
    const metadata = this.metadata.get(userId);
    if (metadata) {
      metadata.lastAccessedAt = Date.now();
    }
  }

  /**
   * Checks if a master key exists in keychain
   * @param userId User identifier
   * @returns True if key exists
   */
  async hasMasterKey(userId: string): Promise<boolean> {
    try {
      const accountName = `master-key_${userId}`;
      const key = await keytar.getPassword(this.SERVICE_NAME, accountName);
      return key !== null;
    } catch (error) {
      console.error('[KeyManagement] Failed to check master key existence:', error);
      return false;
    }
  }

  /**
   * Changes the master key (e.g., after password change)
   * @param userId User identifier
   * @param newPassword New password
   * @returns New master key
   */
  async changeMasterKey(userId: string, newPassword: string): Promise<Buffer> {
    try {
      // Generate new key and salt using Argon2id
      const { key, salt } = await this.deriveKeyFromPasswordAsync(newPassword);

      // Store new key
      await this.storeMasterKey(userId, key, salt);

      console.log(`[KeyManagement] Master key changed for user: ${userId} using Argon2id`);
      return key;
    } catch (error) {
      console.error('[KeyManagement] Failed to change master key:', error);
      throw new Error('Failed to change master key');
    }
  }

  /**
   * Gets key metadata for debugging/monitoring
   * @param userId User identifier
   * @returns Metadata or null
   */
  getKeyMetadata(userId: string): KeyMetadata | null {
    return this.metadata.get(userId) || null;
  }

  /**
   * Cleanup on application shutdown
   */
  async cleanup(): Promise<void> {
    console.log('[KeyManagement] Cleaning up...');
    this.clearAllFromMemory();
  }
}

// Export singleton instance
export const keyManagementService = new KeyManagementService();
