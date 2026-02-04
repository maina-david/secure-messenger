import * as crypto from 'crypto';

export class SecurityService {
  private isInitialized = false;
  private masterKey: Buffer | null = null;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 12;
  private readonly AUTH_TAG_LENGTH = 16;
  private readonly KEY_LENGTH = 32;

  async initialize(): Promise<void> {
    if (!this.masterKey) {
      this.masterKey = crypto.randomBytes(this.KEY_LENGTH);
    }
    this.isInitialized = true;
    console.log('[Security] Service initialized with AES-256-GCM encryption');
  }

  setMasterKeyFromPassword(password: string, salt: string): void {
    this.masterKey = crypto.pbkdf2Sync(password, salt, 100000, this.KEY_LENGTH, 'sha512');
    console.log('[Security] Master key derived from password');
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

  clearMasterKey(): void {
    if (this.masterKey) {
      this.wipe(this.masterKey);
      this.masterKey = null;
    }
    this.isInitialized = false;
    console.log('[Security] Master key cleared from memory');
  }
}

export const securityService = new SecurityService();
