import React, { useState, useEffect, useCallback, useRef } from 'react';
import { searchService, SearchResult } from '../services/SearchService';
import { Message } from '../types';

interface SearchBarProps {
  messages?: Message[];
  currentChatId?: number;
  chatId?: number; // Backward compatibility
  onMessageSelect?: (messageId: number) => void;
  onSearchResults?: (results: Message[]) => void;
  onNavigateResult?: (index: number) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  messages = [],
  currentChatId,
  chatId,
  onMessageSelect,
  onSearchResults,
  onNavigateResult,
  placeholder = 'Search messages...'
}) => {
  // Use chatId if currentChatId not provided (backward compatibility)
  const activeChatId = currentChatId ?? chatId;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      searchService.indexMessages(messages);
    }
  }, [messages]);

  useEffect(() => {
    if (query.trim().length >= 2) {
      const searchResults = activeChatId
        ? searchService.searchInChat(activeChatId, query, 50)
        : searchService.search(query, { limit: 50 });
      setResults(searchResults);
      setIsOpen(true);

      // Call legacy callback if provided
      if (onSearchResults) {
        onSearchResults(searchResults.map(r => r.message));
      }
    } else {
      setResults([]);
      setIsOpen(false);
      if (onSearchResults) {
        onSearchResults([]);
      }
    }
  }, [query, activeChatId, onSearchResults]);

  const handleSelectMessage = (message: Message) => {
    onMessageSelect?.(message.id);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 rounded-lg border bg-background"
      />
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          {results.map((result) => (
            <button
              key={result.message.id}
              onClick={() => handleSelectMessage(result.message)}
              className="w-full px-4 py-3 text-left hover:bg-accent"
            >
              <p className="text-sm">{result.message.body.slice(0, 100)}</p>
              <p className="text-xs text-muted-foreground">{result.message.sender}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
