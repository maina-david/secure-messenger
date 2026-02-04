import React, { useState } from 'react';
import { Search } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ReactionPickerProps {
  trigger: React.ReactNode;
  onSelect: (emoji: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const EMOJI_CATEGORIES = {
  'Recently Used': [] as string[], // Will be populated from localStorage
  Smileys: [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
    '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
    '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
    '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
  ],
  Gestures: [
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
    '👈', '👉', '👆', '👇', '☝️', '👏', '🙌', '👐',
    '🤲', '🤝', '🙏', '✊', '👊', '🤛', '🤜', '💪',
  ],
  Hearts: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
    '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
    '💘', '💝', '💟',
  ],
  Animals: [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
    '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
    '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
  ],
  Food: [
    '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈',
    '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆',
    '🥑', '🥦', '🥬', '🌽', '🌶️', '🥒', '🥕', '🧄',
    '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙',
  ],
  Activities: [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
    '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
    '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
  ],
  Objects: [
    '💡', '🔦', '🕯️', '🪔', '📱', '💻', '⌨️', '🖥️',
    '🖨️', '🖱️', '🎮', '🕹️', '📷', '📹', '🎥', '📞',
    '☎️', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏰',
  ],
  Symbols: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🔴', '🟠',
    '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '✨',
    '⭐', '🌟', '💫', '🔥', '💧', '🌈', '☀️', '🌙',
  ],
};

const ReactionPicker: React.FC<ReactionPickerProps> = ({
  trigger,
  onSelect,
  open,
  onOpenChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Smileys');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('recentEmojis');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleEmojiSelect = (emoji: string) => {
    // Update recent emojis
    const updated = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(0, 24);
    setRecentEmojis(updated);
    try {
      localStorage.setItem('recentEmojis', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }

    onSelect(emoji);
    onOpenChange?.(false);
  };

  // Filter emojis based on search
  const filteredCategories = Object.entries(EMOJI_CATEGORIES).reduce(
    (acc, [category, emojis]) => {
      if (category === 'Recently Used') {
        if (recentEmojis.length > 0 && !searchQuery) {
          acc[category] = recentEmojis;
        }
      } else {
        const filtered = searchQuery
          ? emojis.filter(() => true) // Simple implementation, could add emoji names
          : emojis;
        if (filtered.length > 0) {
          acc[category] = filtered;
        }
      }
      return acc;
    },
    {} as Record<string, string[]>
  );

  const categories = Object.keys(filteredCategories);
  const currentEmojis = filteredCategories[selectedCategory] || [];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-90 p-0" align="start">
        <div className="flex flex-col h-100">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search emojis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 px-2 py-2 border-b overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors',
                  selectedCategory === category
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                )}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Emoji Grid */}
          <ScrollArea className="flex-1">
            <div className="p-3">
              <div className="grid grid-cols-8 gap-2">
                {currentEmojis.map((emoji, index) => (
                  <button
                    key={`${emoji}-${index}`}
                    onClick={() => handleEmojiSelect(emoji)}
                    className="w-10 h-10 flex items-center justify-center text-2xl rounded hover:bg-accent transition-colors"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {currentEmojis.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {searchQuery ? 'No emojis found' : 'No emojis in this category'}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ReactionPicker;
