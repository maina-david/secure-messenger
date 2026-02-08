import { BaseRepository } from './BaseRepository';

export interface Contact {
  id: number;
  userId: string;
  name: string;
  avatar?: string | null;
  status?: string | null;
  lastSeen?: number | null;
  createdAt: number;
}

export class ContactRepository extends BaseRepository {
  /**
   * Get contacts with pagination
   */
  getContacts(limit: number = 100, offset: number = 0): Contact[] {
    const stmt = this.prepare(`
      SELECT * FROM contacts
      ORDER BY name COLLATE NOCASE
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as Contact[];
  }

  /**
   * Search contacts by name or userId
   */
  searchContacts(query: string): Contact[] {
    const stmt = this.prepare(`
      SELECT * FROM contacts
      WHERE name LIKE ? OR userId LIKE ?
      ORDER BY name COLLATE NOCASE
      LIMIT 50
    `);
    const searchTerm = `%${query}%`;
    return stmt.all(searchTerm, searchTerm) as Contact[];
  }

  /**
   * Get contact by userId
   */
  getContactByUserId(userId: string): Contact | undefined {
    const stmt = this.prepare(`
      SELECT * FROM contacts
      WHERE userId = ?
    `);
    return stmt.get(userId) as Contact | undefined;
  }

  /**
   * Create a new contact
   */
  createContact(userId: string, name: string, avatar?: string, status?: string): number {
    return this.insert('contacts', {
      userId,
      name,
      avatar: avatar || null,
      status: status || null,
      lastSeen: Date.now(),
      createdAt: Date.now()
    });
  }

  /**
   * Update contact information
   */
  updateContact(userId: string, updates: Partial<Pick<Contact, 'name' | 'avatar' | 'status' | 'lastSeen'>>): boolean {
    const changes = this.update('contacts', updates, 'userId = ?', userId);
    return changes > 0;
  }

  /**
   * Delete a contact
   */
  deleteContact(userId: string): boolean {
    const changes = this.delete('contacts', 'userId = ?', userId);
    return changes > 0;
  }

  /**
   * Check if contact exists
   */
  contactExists(userId: string): boolean {
    return this.exists('contacts', 'userId', userId);
  }
}
