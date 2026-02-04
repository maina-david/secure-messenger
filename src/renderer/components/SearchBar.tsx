import React, { useState, useEffect } from 'react';
import { Search, X, ChevronUp, ChevronDown, Filter, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Message, SearchOptions } from '../types';

interface SearchBarProps {
  chatId: number;
  onSearchResults: (results: Message[]) => void;
  onNavigateResult: (index: number) => void;
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  chatId,
  onSearchResults,
  onNavigateResult,
  className,
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Message[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Advanced filters
  const [selectedSender, setSelectedSender] = useState<string>('all');
  const [hasMedia, setHasMedia] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [senders, setSenders] = useState<string[]>([]);

  // Load senders when component mounts
  useEffect(() => {
    const loadSenders = async () => {
      try {
        const response = await window.electronAPI.getAllSenders();
        if (response.success && response.data) {
          setSenders(response.data);
        }
      } catch (error) {
        console.error('Failed to load senders:', error);
      }
    };
    loadSenders();
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      // Use basic search for now (limit to 50 results as per requirements)
      const response = await window.electronAPI.searchMessages(chatId, query.trim(), 50);

      if (response.success && response.data) {
        let filteredResults = response.data;

        // Apply client-side filters if advanced filters are used
        if (selectedSender !== 'all') {
          filteredResults = filteredResults.filter(msg => msg.sender === selectedSender);
        }

        if (dateFrom) {
          const fromTime = new Date(dateFrom).getTime();
          filteredResults = filteredResults.filter(msg => msg.ts >= fromTime);
        }

        if (dateTo) {
          const toTime = new Date(dateTo).getTime() + 86400000; // End of day
          filteredResults = filteredResults.filter(msg => msg.ts < toTime);
        }

        // Filter by media if needed (client-side)
        if (hasMedia) {
          const mediaResults: Message[] = [];
          for (const msg of filteredResults) {
            const mediaResponse = await window.electronAPI.getMediaAttachments(msg.id);
            if (mediaResponse.success && mediaResponse.data && mediaResponse.data.length > 0) {
              mediaResults.push(msg);
            }
          }
          filteredResults = mediaResults;
        }

        setResults(filteredResults);
        setCurrentResultIndex(0);
        onSearchResults(filteredResults);

        if (filteredResults.length > 0) {
          onNavigateResult(0);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setCurrentResultIndex(0);
    setSelectedSender('all');
    setHasMedia(false);
    setDateFrom('');
    setDateTo('');
    onSearchResults([]);
  };

  const handlePrevious = () => {
    if (results.length === 0) return;
    const newIndex = currentResultIndex > 0 ? currentResultIndex - 1 : results.length - 1;
    setCurrentResultIndex(newIndex);
    onNavigateResult(newIndex);
  };

  const handleNext = () => {
    if (results.length === 0) return;
    const newIndex = currentResultIndex < results.length - 1 ? currentResultIndex + 1 : 0;
    setCurrentResultIndex(newIndex);
    onNavigateResult(newIndex);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      handleClear();
    }
  };

  const hasActiveFilters = selectedSender !== 'all' || hasMedia || dateFrom || dateTo;

  return (
    <div className={cn('border-b bg-card p-3', className)}>
      <div className="flex items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-9"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Button */}
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(hasActiveFilters && 'border-primary text-primary')}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Search Filters</h4>

              {/* Sender Filter */}
              <div className="space-y-2">
                <Label className="text-xs">Sender</Label>
                <Select value={selectedSender} onValueChange={setSelectedSender}>
                  <SelectTrigger>
                    <SelectValue placeholder="All senders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All senders</SelectItem>
                    {senders.map((sender) => (
                      <SelectItem key={sender} value={sender}>
                        {sender}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label className="text-xs">Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      placeholder="From"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      placeholder="To"
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Has Media Checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="has-media"
                  checked={hasMedia}
                  onCheckedChange={(checked) => setHasMedia(checked as boolean)}
                />
                <Label htmlFor="has-media" className="text-xs cursor-pointer">
                  Only messages with media
                </Label>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedSender('all');
                    setHasMedia(false);
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Search Button */}
        <Button onClick={handleSearch} disabled={!query.trim() || isSearching}>
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {/* Results Navigation */}
      {results.length > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">
            {currentResultIndex + 1} of {results.length} result{results.length > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handlePrevious}
              disabled={results.length === 0}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleNext}
              disabled={results.length === 0}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
