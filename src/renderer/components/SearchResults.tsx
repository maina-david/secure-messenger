import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Message } from '../types';
import { cn } from '@/lib/utils';

interface SearchResultsProps {
  results: Message[];
  currentIndex: number;
  onResultClick: (index: number) => void;
  className?: string;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  currentIndex,
  onResultClick,
  className,
}) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const highlightQuery = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800">
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const message = results[index];
    const isSelected = index === currentIndex;

    return (
      <div
        style={style}
        className={cn(
          'flex items-start gap-3 px-4 py-2 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/40',
          isSelected && 'bg-accent'
        )}
        onClick={() => onResultClick(index)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{message.sender}</span>
            <span className="text-xs text-muted-foreground">{formatTime(message.ts)}</span>
          </div>
          <div className="text-sm text-foreground/80 truncate">
            {message.body}
          </div>
        </div>
      </div>
    );
  };

  if (results.length === 0) {
    return (
      <div className={cn('p-4 text-center text-sm text-muted-foreground', className)}>
        No results found
      </div>
    );
  }

  return (
    <div className={cn('border-b border-border bg-card', className)}>
      <List
        height={Math.min(results.length * 64, 300)} // Max height of 300px
        itemCount={results.length}
        itemSize={64}
        width="100%"
      >
        {Row}
      </List>
    </div>
  );
};

export default SearchResults;
