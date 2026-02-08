import { BaseService } from './BaseService';
import { UserRepository, User, Session } from '../database/UserRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { rateLimitService } from './RateLimitService';

export interface SignupOptions {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
}

export interface LoginResult {
  user: Omit<User, 'passwordHash'>;
  session: Session;
}

export class AuthService extends BaseService {
  private userRepo: UserRepository;

  constructor(dbConnection?: DatabaseConnection) {
    super(dbConnection);
    this.userRepo = new UserRepository(dbConnection);
  }

  /**
   * Sign up a new user
   */
  async signup(options: SignupOptions): Promise<LoginResult> {
    this.validateRequired(options, ['username', 'password']);

    const { username, password, email, displayName } = options;

    // Validate username
    if (username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    // Validate password strength
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Check if username already exists
    const existingUser = this.userRepo.getByUsername(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Check if email already exists
    if (email) {
      const existingEmail = this.userRepo.getByEmail(email);
      if (existingEmail) {
        throw new Error('Email already registered');
      }
    }

    // Create user
    const userId = await this.userRepo.create(username, password, email, displayName);

    // Initialize security for the new user
    const initialized = await this.security.initializeForUser(userId.toString(), password);
    if (!initialized) {
      // Rollback user creation if encryption setup fails
      this.userRepo.deleteUser(userId);
      throw new Error('Failed to initialize encryption');
    }

    // Create session
    const session = this.userRepo.createSession(userId);

    // Get user info without password hash
    const user = this.userRepo.getById(userId);
    if (!user) {
      throw new Error('User creation failed');
    }

    const { passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      session
    };
  }

  /**
   * Login a user
   */
  async login(username: string, password: string): Promise<LoginResult> {
    // Check rate limiting
    if (!rateLimitService.recordAttempt(username)) {
      const remainingMs = rateLimitService.getBlockTimeRemaining(username);
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new Error(
        `Too many failed login attempts. Please try again in ${remainingMinutes} minute(s).`
      );
    }

    // Verify credentials
    const user = await this.userRepo.verifyCredentials(username, password);
    if (!user) {
      const remaining = rateLimitService.getRemainingAttempts(username);
      const errorMsg = remaining !== null && remaining > 0
        ? `Invalid username or password. ${remaining} attempt(s) remaining.`
        : 'Invalid username or password.';
      throw new Error(errorMsg);
    }

    // Successful login - reset rate limit
    rateLimitService.reset(username);

    // Initialize security for the user
    const initialized = await this.security.initializeForUser(user.id.toString(), password);
    if (!initialized) {
      throw new Error('Failed to initialize encryption');
    }

    // Create session
    const session = this.userRepo.createSession(user.id);

    const { passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      session
    };
  }

  /**
   * Logout a user
   */
  logout(token: string): boolean {
    // Destroy session
    const destroyed = this.userRepo.destroySession(token);

    // Clear security keys from memory
    this.security.clearMasterKey();

    return destroyed;
  }

  /**
   * Validate a session token
   */
  validateSession(token: string): Session | null {
    return this.userRepo.validateSession(token);
  }

  /**
   * Get user by ID
   */
  getUser(userId: number): Omit<User, 'passwordHash'> | null {
    const user = this.userRepo.getById(userId);
    if (!user) return null;

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update user profile
   */
  updateProfile(userId: number, updates: {
    email?: string;
    displayName?: string;
  }): boolean {
    // Validate email if provided
    if (updates.email) {
      const existingEmail = this.userRepo.getByEmail(updates.email);
      if (existingEmail && existingEmail.id !== userId) {
        throw new Error('Email already in use');
      }
    }

    return this.userRepo.updateProfile(userId, updates);
  }

  /**
   * Change password
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    // Validate new password
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    // Verify current password
    const user = this.userRepo.getById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const credentials = await this.userRepo.verifyCredentials(user.username, currentPassword);
    if (!credentials) {
      throw new Error('Current password is incorrect');
    }

    // Update password in database
    await this.userRepo.updatePassword(userId, newPassword);

    // Change master encryption key
    const keyChanged = await this.security.changeMasterKey(newPassword);
    if (!keyChanged) {
      throw new Error('Failed to update encryption key');
    }

    // Destroy all sessions except current one (force re-login on other devices)
    this.userRepo.destroyUserSessions(userId);

    return true;
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: number, password: string): Promise<boolean> {
    // Verify password
    const user = this.userRepo.getById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const credentials = await this.userRepo.verifyCredentials(user.username, password);
    if (!credentials) {
      throw new Error('Password is incorrect');
    }

    // Delete master key from keychain
    await this.security.deleteMasterKey();

    // Delete user (cascades to sessions)
    return this.userRepo.deleteUser(userId);
  }

  /**
   * Get active sessions for a user
   */
  getUserSessions(userId: number): Session[] {
    return this.userRepo.getUserSessions(userId);
  }

  /**
   * Revoke a specific session
   */
  revokeSession(token: string): boolean {
    return this.userRepo.destroySession(token);
  }

  /**
   * Revoke all sessions for a user (force logout everywhere)
   */
  revokeAllSessions(userId: number): number {
    return this.userRepo.destroyUserSessions(userId);
  }

  /**
   * Cleanup expired sessions (should be run periodically)
   */
  cleanupExpiredSessions(): number {
    return this.userRepo.cleanupExpiredSessions();
  }
}
