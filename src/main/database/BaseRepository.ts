import Database from 'better-sqlite3';
import { DatabaseConnection } from './DatabaseConnection';

export abstract class BaseRepository {
  protected db: Database.Database;

  constructor(connection?: DatabaseConnection) {
    const conn = connection || DatabaseConnection.getInstance();
    this.db = conn.getDatabase();
  }

  /**
   * Execute a transaction
   * @param callback Function to execute within transaction
   * @returns Result of callback
   */
  protected transaction<T>(callback: () => T): T {
    const transaction = this.db.transaction(callback);
    return transaction();
  }

  /**
   * Prepare and cache a statement
   * @param sql SQL query
   * @returns Prepared statement
   */
  protected prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  /**
   * Execute raw SQL (use sparingly)
   * @param sql SQL to execute
   */
  protected exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Check if a record exists
   * @param table Table name
   * @param column Column name
   * @param value Value to check
   * @returns True if exists
   */
  protected exists(table: string, column: string, value: any): boolean {
    const stmt = this.db.prepare(`SELECT 1 FROM ${table} WHERE ${column} = ? LIMIT 1`);
    const result = stmt.get(value);
    return result !== undefined;
  }

  /**
   * Count records in a table
   * @param table Table name
   * @param where Optional WHERE clause
   * @param params Optional parameters
   * @returns Count
   */
  protected count(table: string, where?: string, ...params: any[]): number {
    const sql = where
      ? `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`
      : `SELECT COUNT(*) as count FROM ${table}`;

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  /**
   * Delete records
   * @param table Table name
   * @param where WHERE clause
   * @param params Parameters
   * @returns Number of deleted records
   */
  protected delete(table: string, where: string, ...params: any[]): number {
    const stmt = this.db.prepare(`DELETE FROM ${table} WHERE ${where}`);
    const result = stmt.run(...params);
    return result.changes;
  }

  /**
   * Update records
   * @param table Table name
   * @param set Object with column-value pairs to update
   * @param where WHERE clause
   * @param params Parameters for WHERE clause
   * @returns Number of updated records
   */
  protected update(
    table: string,
    set: Record<string, any>,
    where: string,
    ...params: any[]
  ): number {
    const setClause = Object.keys(set).map(key => `${key} = ?`).join(', ');
    const setValues = Object.values(set);

    const stmt = this.db.prepare(`UPDATE ${table} SET ${setClause} WHERE ${where}`);
    const result = stmt.run(...setValues, ...params);
    return result.changes;
  }

  /**
   * Insert a record
   * @param table Table name
   * @param data Object with column-value pairs
   * @returns Last insert row ID
   */
  protected insert(table: string, data: Record<string, any>): number {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const stmt = this.db.prepare(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`);
    const result = stmt.run(...values);
    return result.lastInsertRowid as number;
  }
}
