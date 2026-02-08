import { DatabaseConnection } from '../database/DatabaseConnection';
import { securityService } from './SecurityService';

export abstract class BaseService {
  protected db: DatabaseConnection;
  protected security = securityService;

  constructor(dbConnection?: DatabaseConnection) {
    this.db = dbConnection || DatabaseConnection.getInstance();
  }

  /**
   * Execute a database transaction with error handling
   * @param callback Function to execute within transaction
   * @returns Result of callback
   */
  protected transaction<T>(callback: () => T): T {
    const db = this.db.getDatabase();
    const transaction = db.transaction(callback);
    return transaction();
  }

  /**
   * Execute an async operation with error handling and logging
   * @param operation Operation to execute
   * @param context Context description for logging
   * @returns Result of operation
   */
  protected async executeAsync<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(`[${this.constructor.name}] ${context} failed:`, error);
      throw error;
    }
  }

  /**
   * Validate required fields
   * @param data Data to validate
   * @param requiredFields List of required field names
   * @throws Error if validation fails
   */
  protected validateRequired(data: Record<string, any>, requiredFields: string[]): void {
    const missing = requiredFields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Execute a transaction asynchronously
   * Note: SQLite transactions are synchronous, but this wrapper allows
   * async operations before/after the transaction
   * @param callback Function to execute
   * @returns Promise of result
   */
  protected async asyncTransaction<T>(callback: () => T): Promise<T> {
    return this.transaction(callback);
  }
}
