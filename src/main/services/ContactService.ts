import { BaseService } from './BaseService';
import { ContactRepository, Contact } from '../database/ContactRepository';
import { ChatRepository } from '../database/ChatRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';

export class ContactService extends BaseService {
  private contactRepo: ContactRepository;
  private chatRepo: ChatRepository;

  constructor(dbConnection?: DatabaseConnection) {
    super(dbConnection);
    this.contactRepo = new ContactRepository(dbConnection);
    this.chatRepo = new ChatRepository(dbConnection);
  }

  /**
   * Get contacts with pagination
   */
  getContacts(limit: number = 100, offset: number = 0): Contact[] {
    return this.contactRepo.getContacts(limit, offset);
  }

  /**
   * Search contacts by name or userId
   */
  searchContacts(query: string): Contact[] {
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }
    return this.contactRepo.searchContacts(query);
  }

  /**
   * Get contact by userId
   */
  getContactByUserId(userId: string): Contact | null {
    return this.contactRepo.getContactByUserId(userId) || null;
  }

  /**
   * Create a new contact
   */
  createContact(userId: string, name: string, avatar?: string, status?: string): number {
    this.validateRequired({ userId, name }, ['userId', 'name']);

    if (name.trim().length === 0) {
      throw new Error('Contact name cannot be empty');
    }

    return this.contactRepo.createContact(userId, name, avatar, status);
  }

  /**
   * Update contact information
   */
  updateContact(userId: string, updates: Partial<Pick<Contact, 'name' | 'avatar' | 'status' | 'lastSeen'>>): boolean {
    return this.contactRepo.updateContact(userId, updates);
  }

  /**
   * Delete a contact
   */
  deleteContact(userId: string): boolean {
    return this.contactRepo.deleteContact(userId);
  }

  /**
   * Create a chat with a contact
   */
  createChatWithContact(userId: string): number | null {
    try {
      return this.transaction(() => {
        // Check if contact exists
        const contact = this.contactRepo.getContactByUserId(userId);
        if (!contact) {
          throw new Error('Contact not found');
        }

        // Check if chat already exists with this contact
        const chats = this.chatRepo.getList(1000);
        const existingChat = chats.find(chat => chat.title === contact.name);

        if (existingChat) {
          return existingChat.id;
        }

        // Create new chat
        const chatId = this.chatRepo.create(contact.name, Date.now());
        return chatId;
      });
    } catch (error) {
      console.error('[ContactService] Error creating chat with contact:', error);
      return null;
    }
  }

  /**
   * Check if contact exists
   */
  contactExists(userId: string): boolean {
    return this.contactRepo.contactExists(userId);
  }
}
