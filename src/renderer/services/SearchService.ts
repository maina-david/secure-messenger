import Fuse from 'fuse.js';
import type { IFuseOptions, FuseResult, FuseResultMatch } from 'fuse.js';
import { Message } from '../types';

export interface SearchResult {
  message: Message;
  score: number;
  matches: FuseResultMatch[];
}

export class SearchService {
  private fuse: Fuse<Message> | null = null;
  private messages: Message[] = [];

  private readonly fuseOptions: IFuseOptions<Message> = {
    keys: [
      {
        name: 'body',
        weight: 0.7
      },
      {
        name: 'sender',
        weight: 0.3
      }
    ],
    threshold: 0.3, // 0.0 = perfect match, 1.0 = match anything
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true, // Search entire string
    useExtendedSearch: true // Allows operators like 'hello | world'
  };

  /**
   * Initialize or update the search index with messages
   * @param messages Decrypted messages to index
   */
  indexMessages(messages: Message[]): void {
    this.messages = messages;
    this.fuse = new Fuse(messages, this.fuseOptions);
    console.log(`[SearchService] Indexed ${messages.length} messages`);
  }

  /**
   * Add a new message to the index
   * @param message Message to add
   */
  addMessage(message: Message): void {
    this.messages.push(message);
    if (this.fuse) {
      // Rebuild index with new message
      this.fuse.setCollection(this.messages);
    } else {
      this.fuse = new Fuse(this.messages, this.fuseOptions);
    }
  }

  /**
   * Update an existing message in the index
   * @param updatedMessage Updated message
   */
  updateMessage(updatedMessage: Message): void {
    const index = this.messages.findIndex(m => m.id === updatedMessage.id);
    if (index !== -1) {
      this.messages[index] = updatedMessage;
      if (this.fuse) {
        this.fuse.setCollection(this.messages);
      }
    }
  }

  /**
   * Remove a message from the index
   * @param messageId ID of message to remove
   */
  removeMessage(messageId: number): void {
    this.messages = this.messages.filter(m => m.id !== messageId);
    if (this.fuse) {
      this.fuse.setCollection(this.messages);
    }
  }

  /**
   * Search for messages matching the query
   * @param query Search query
   * @param options Search options
   * @returns Array of search results with scores
   */
  search(
    query: string,
    options: {
      limit?: number;
      chatId?: number;
      sender?: string;
      dateFrom?: number;
      dateTo?: number;
    } = {}
  ): SearchResult[] {
    if (!this.fuse || !query.trim()) {
      return [];
    }

    const { limit = 50, chatId, sender, dateFrom, dateTo } = options;

    // Perform fuzzy search
    let results = this.fuse.search(query, { limit: limit * 2 }); // Get extra for filtering

    // Filter by additional criteria
    if (chatId !== undefined || sender || dateFrom || dateTo) {
      results = results.filter(result => {
        const message = result.item;

        if (chatId !== undefined && message.chatId !== chatId) {
          return false;
        }

        if (sender && message.sender !== sender) {
          return false;
        }

        if (dateFrom && message.ts < dateFrom) {
          return false;
        }

        if (dateTo && message.ts > dateTo) {
          return false;
        }

        return true;
      });
    }

    // Limit results
    results = results.slice(0, limit);

    // Convert to SearchResult format
    return results.map(result => ({
      message: result.item,
      score: result.score || 0,
      matches: (result.matches || []) as FuseResultMatch[]
    }));
  }

  /**
   * Search within a specific chat
   * @param chatId Chat ID to search in
   * @param query Search query
   * @param limit Maximum results
   * @returns Array of search results
   */
  searchInChat(chatId: number, query: string, limit: number = 50): SearchResult[] {
    return this.search(query, { chatId, limit });
  }

  /**
   * Search by sender
   * @param sender Sender name
   * @param query Search query
   * @param limit Maximum results
   * @returns Array of search results
   */
  searchBySender(sender: string, query: string, limit: number = 50): SearchResult[] {
    return this.search(query, { sender, limit });
  }

  /**
   * Search within a date range
   * @param query Search query
   * @param dateFrom Start timestamp
   * @param dateTo End timestamp
   * @param limit Maximum results
   * @returns Array of search results
   */
  searchByDateRange(
    query: string,
    dateFrom: number,
    dateTo: number,
    limit: number = 50
  ): SearchResult[] {
    return this.search(query, { dateFrom, dateTo, limit });
  }

  /**
   * Get suggestions based on partial query
   * @param partialQuery Partial search query
   * @param limit Maximum suggestions
   * @returns Array of suggested messages
   */
  getSuggestions(partialQuery: string, limit: number = 5): Message[] {
    if (!this.fuse || !partialQuery.trim() || partialQuery.length < 2) {
      return [];
    }

    const results = this.fuse.search(partialQuery, { limit });
    return results.map(result => result.item);
  }

  /**
   * Get search statistics
   * @returns Statistics about the search index
   */
  getStats(): {
    totalMessages: number;
    uniqueSenders: number;
    uniqueChats: number;
  } {
    const uniqueSenders = new Set(this.messages.map(m => m.sender)).size;
    const uniqueChats = new Set(this.messages.map(m => m.chatId)).size;

    return {
      totalMessages: this.messages.length,
      uniqueSenders,
      uniqueChats
    };
  }

  /**
   * Clear the search index
   */
  clear(): void {
    this.messages = [];
    this.fuse = null;
    console.log('[SearchService] Index cleared');
  }

  /**
   * Check if the index is ready
   * @returns True if index is initialized
   */
  isReady(): boolean {
    return this.fuse !== null && this.messages.length > 0;
  }

  /**
   * Get the number of indexed messages
   * @returns Number of messages in index
   */
  getIndexSize(): number {
    return this.messages.length;
  }
}

// Export singleton instance
export const searchService = new SearchService();
