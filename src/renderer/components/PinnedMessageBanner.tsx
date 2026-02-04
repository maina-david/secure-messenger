import React, { useState, useEffect } from 'react';
import { Pin, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Message, PinnedMessage } from '../types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PinnedMessageBannerProps {
  chatId: number;
  pinnedMessages: PinnedMessage[];
  messages: Message[];
  onNavigateToMessage: (messageId: number) => void;
  onUnpin: (messageId: number) => void;
}

const PinnedMessageBanner: React.FC<PinnedMessageBannerProps> = ({
  chatId,
  pinnedMessages,
  messages,
  onNavigateToMessage,
  onUnpin,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);

  // Get the actual messages for pinned message IDs
  const pinnedMessageDetails = pinnedMessages
    .map((pm) => messages.find((m) => m.id === pm.messageId))
    .filter((m): m is Message => m !== undefined);

  useEffect(() => {
    // Reset index if it's out of bounds
    if (currentIndex >= pinnedMessageDetails.length) {
      setCurrentIndex(0);
    }
  }, [pinnedMessageDetails.length, currentIndex]);

  if (pinnedMessageDetails.length === 0) {
    return null;
  }

  const currentMessage = pinnedMessageDetails[currentIndex];
  const hasMultiple = pinnedMessageDetails.length > 1;

  const handlePrevious = () => {
    setCurrentIndex((prev) =>
      prev > 0 ? prev - 1 : pinnedMessageDetails.length - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prev) =>
      prev < pinnedMessageDetails.length - 1 ? prev + 1 : 0
    );
  };

  const handleNavigate = () => {
    if (currentMessage) {
      onNavigateToMessage(currentMessage.id);
    }
  };

  const handleUnpin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMessage) {
      onUnpin(currentMessage.id);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={cn(
        'bg-accent border-b border-border transition-all',
        !isExpanded && 'cursor-pointer hover:bg-accent/80'
      )}
      onClick={!isExpanded ? handleToggleExpand : undefined}
    >
      <div className="px-4 py-2 flex items-center gap-3">
        {/* Pin Icon */}
        <div className="flex-shrink-0">
          <Pin className="h-4 w-4 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isExpanded ? (
            <div
              className="cursor-pointer hover:underline"
              onClick={handleNavigate}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-primary">
                  Pinned Message
                </span>
                {hasMultiple && (
                  <span className="text-xs text-muted-foreground">
                    ({currentIndex + 1} of {pinnedMessageDetails.length})
                  </span>
                )}
              </div>
              {currentMessage && (
                <div>
                  <span className="text-xs font-medium mr-2">
                    {currentMessage.sender}:
                  </span>
                  <span className="text-sm text-muted-foreground line-clamp-1">
                    {currentMessage.body}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary">
                Pinned Message
              </span>
              {hasMultiple && (
                <span className="text-xs text-muted-foreground">
                  ({pinnedMessageDetails.length})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation Controls */}
        {isExpanded && hasMultiple && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isExpanded && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleUnpin}
              title="Unpin message"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleToggleExpand}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronLeft className="h-4 w-4 rotate-90" />
            ) : (
              <ChevronRight className="h-4 w-4 -rotate-90" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PinnedMessageBanner;
