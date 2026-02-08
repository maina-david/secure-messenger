interface RateLimitEntry {
  attempts: number[];
  blockedUntil: number | null;
}

export interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

export class RateLimitService {
  private attempts: Map<string, RateLimitEntry> = new Map();

  // Default configuration (OWASP recommended)
  private readonly DEFAULT_OPTIONS: RateLimitOptions = {
    maxAttempts: 5, // 5 attempts
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 15 * 60 * 1000 // Block for 15 minutes after exceeding limit
  };

  /**
   * Records an attempt for a given identifier (e.g., username, IP)
   * @param identifier Unique identifier (username, IP address, etc.)
   * @param options Optional rate limit configuration
   * @returns True if attempt is allowed, false if rate limited
   */
  recordAttempt(identifier: string, options?: Partial<RateLimitOptions>): boolean {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const now = Date.now();

    // Get or create entry for this identifier
    let entry = this.attempts.get(identifier);
    if (!entry) {
      entry = {
        attempts: [],
        blockedUntil: null
      };
      this.attempts.set(identifier, entry);
    }

    // Check if currently blocked
    if (entry.blockedUntil && entry.blockedUntil > now) {
      const remainingMs = entry.blockedUntil - now;
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      console.log(`[RateLimit] ${identifier} is blocked for ${remainingMinutes} more minute(s)`);
      return false;
    }

    // Clear block if expired
    if (entry.blockedUntil && entry.blockedUntil <= now) {
      entry.blockedUntil = null;
      entry.attempts = [];
    }

    // Remove attempts outside the time window
    const windowStart = now - config.windowMs;
    entry.attempts = entry.attempts.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (entry.attempts.length >= config.maxAttempts) {
      entry.blockedUntil = now + config.blockDurationMs;
      console.warn(`[RateLimit] ${identifier} exceeded rate limit. Blocked until ${new Date(entry.blockedUntil).toISOString()}`);
      return false;
    }

    // Record this attempt
    entry.attempts.push(now);
    const remaining = config.maxAttempts - entry.attempts.length;
    console.log(`[RateLimit] ${identifier} has ${remaining} attempt(s) remaining in this window`);

    return true;
  }

  /**
   * Checks if an identifier is currently rate limited without recording an attempt
   * @param identifier Unique identifier
   * @param options Optional rate limit configuration
   * @returns True if rate limited, false if allowed
   */
  isRateLimited(identifier: string, options?: Partial<RateLimitOptions>): boolean {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const now = Date.now();

    const entry = this.attempts.get(identifier);
    if (!entry) {
      return false;
    }

    // Check if blocked
    if (entry.blockedUntil && entry.blockedUntil > now) {
      return true;
    }

    // Check attempts in window
    const windowStart = now - config.windowMs;
    const recentAttempts = entry.attempts.filter(timestamp => timestamp > windowStart);

    return recentAttempts.length >= config.maxAttempts;
  }

  /**
   * Gets remaining attempts for an identifier
   * @param identifier Unique identifier
   * @param options Optional rate limit configuration
   * @returns Number of remaining attempts, or null if blocked
   */
  getRemainingAttempts(identifier: string, options?: Partial<RateLimitOptions>): number | null {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const now = Date.now();

    const entry = this.attempts.get(identifier);
    if (!entry) {
      return config.maxAttempts;
    }

    // Check if blocked
    if (entry.blockedUntil && entry.blockedUntil > now) {
      return null;
    }

    // Count attempts in window
    const windowStart = now - config.windowMs;
    const recentAttempts = entry.attempts.filter(timestamp => timestamp > windowStart);

    return Math.max(0, config.maxAttempts - recentAttempts.length);
  }

  /**
   * Gets time remaining until unblocked (in milliseconds)
   * @param identifier Unique identifier
   * @returns Milliseconds until unblocked, or 0 if not blocked
   */
  getBlockTimeRemaining(identifier: string): number {
    const now = Date.now();
    const entry = this.attempts.get(identifier);

    if (!entry || !entry.blockedUntil || entry.blockedUntil <= now) {
      return 0;
    }

    return entry.blockedUntil - now;
  }

  /**
   * Resets rate limit for an identifier (e.g., after successful login)
   * @param identifier Unique identifier
   */
  reset(identifier: string): void {
    this.attempts.delete(identifier);
    console.log(`[RateLimit] Reset rate limit for ${identifier}`);
  }

  /**
   * Manually blocks an identifier for a duration
   * @param identifier Unique identifier
   * @param durationMs Block duration in milliseconds
   */
  block(identifier: string, durationMs: number): void {
    const now = Date.now();
    const entry = this.attempts.get(identifier) || { attempts: [], blockedUntil: null };

    entry.blockedUntil = now + durationMs;
    this.attempts.set(identifier, entry);

    console.warn(`[RateLimit] Manually blocked ${identifier} for ${durationMs}ms`);
  }

  /**
   * Clears all rate limit data
   */
  clear(): void {
    this.attempts.clear();
    console.log('[RateLimit] Cleared all rate limit data');
  }

  /**
   * Cleans up expired entries (should be called periodically)
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [identifier, entry] of this.attempts.entries()) {
      // Remove if no recent attempts and not blocked
      const hasRecentAttempts = entry.attempts.some(timestamp => (now - timestamp) < maxAge);
      const isBlocked = entry.blockedUntil && entry.blockedUntil > now;

      if (!hasRecentAttempts && !isBlocked) {
        this.attempts.delete(identifier);
      }
    }

    console.log(`[RateLimit] Cleanup complete. ${this.attempts.size} entries remaining`);
  }

  /**
   * Gets statistics about rate limiting
   */
  getStats(): {
    totalTracked: number;
    currentlyBlocked: number;
    totalAttempts: number;
  } {
    const now = Date.now();
    let currentlyBlocked = 0;
    let totalAttempts = 0;

    for (const entry of this.attempts.values()) {
      if (entry.blockedUntil && entry.blockedUntil > now) {
        currentlyBlocked++;
      }
      totalAttempts += entry.attempts.length;
    }

    return {
      totalTracked: this.attempts.size,
      currentlyBlocked,
      totalAttempts
    };
  }

  /**
   * Start periodic cleanup (every hour)
   */
  startCleanupInterval(): NodeJS.Timeout {
    return setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000); // Every hour
  }
}

// Export singleton instance
export const rateLimitService = new RateLimitService();
