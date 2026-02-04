import React, { useState, useRef, useEffect } from 'react';
import { Message, Reaction } from '../types';
import { formatDistanceToNow } from 'date-fns';
import {
  MoreVertical,
  Edit2,
  Trash2,
  Reply,
  Pin,
  Forward,
  Smile,
  Check,
  CheckCheck,
  CornerUpLeft,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReactionPicker from './ReactionPicker';

interface MessageRowProps {
  message: Message;
  currentUserId: string;
  reactions?: Reaction[];
  readReceipts?: number;
  isPinned?: boolean;
  replyToMessage?: Message | null;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: number) => void;
  onReply?: (message: Message) => void;
  onPin?: (messageId: number) => void;
  onForward?: (messageId: number) => void;
  onReact?: (messageId: number, emoji: string) => void;
  onNavigateToReply?: (messageId: number) => void;
}

const MessageRow: React.FC<MessageRowProps> = ({
  message,
  currentUserId,
  reactions = [],
  readReceipts = 0,
  isPinned = false,
  replyToMessage,
  onEdit,
  onDelete,
  onReply,
  onPin,
  onForward,
  onReact,
  onNavigateToReply,
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [showFocusedReactions, setShowFocusedReactions] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const isSwipingRef = useRef(false);

  const isOwnMessage = message.sender === currentUserId;
  const isDeleted = message.isDeleted === 1;
  const isEdited = !!message.editedAt;

  const SWIPE_THRESHOLD = 80;
  const LONG_PRESS_DURATION = 500;

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = { emoji: reaction.emoji, count: 0, users: [] };
    }
    acc[reaction.emoji].count++;
    acc[reaction.emoji].users.push(reaction.userId);
    return acc;
  }, {} as Record<string, { emoji: string; count: number; users: string[] }>);

  const handleReactionSelect = (emoji: string) => {
    onReact?.(message.id, emoji);
    setShowReactions(false);
    setShowFocusedReactions(false);
    setIsLongPressing(false);
  };

  // Touch event handlers for swipe and long press
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isSwipingRef.current = false;

    longPressTimer.current = setTimeout(() => {
      setIsLongPressing(true);
      setShowFocusedReactions(true);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, LONG_PRESS_DURATION);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isLongPressing) {
      e.preventDefault();
      return;
    }

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);

    if (Math.abs(deltaX) > 10 && deltaY < 30) {
      isSwipingRef.current = true;
      const offset = Math.max(0, Math.min(deltaX, SWIPE_THRESHOLD));
      setSwipeOffset(offset);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (swipeOffset >= SWIPE_THRESHOLD) {
      onReply?.(message);
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }

    setSwipeOffset(0);
    isSwipingRef.current = false;
  };

  // Mouse event handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    longPressTimer.current = setTimeout(() => {
      setIsLongPressing(true);
      setShowFocusedReactions(true);
    }, LONG_PRESS_DURATION);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const closeFocusedMode = () => {
    setIsLongPressing(false);
    setShowFocusedReactions(false);
  };

  if (isDeleted) {
    return (
      <div className="flex items-center gap-2 py-2 px-4 opacity-50">
        <Trash2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm italic text-muted-foreground">
          This message was deleted
        </span>
      </div>
    );
  }

  const quickReactions = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

  return (
    <>
      {/* Backdrop for focused mode */}
      {showFocusedReactions && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={closeFocusedMode}
        />
      )}

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={messageRef}
            className={cn(
              'group relative flex gap-3 px-4 py-2 transition-all duration-200',
              !showFocusedReactions && 'hover:bg-accent/50',
              isPinned && 'bg-accent/30',
              showFocusedReactions && 'z-50 scale-105 rounded-lg shadow-2xl bg-card',
              isOwnMessage && 'flex-row-reverse'
            )}
            style={{
              transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
              transition: swipeOffset === 0 ? 'transform 0.2s ease-out' : 'none',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            {/* Swipe Reply Indicator */}
            {swipeOffset > 20 && (
              <div
                className="absolute left-0 top-0 bottom-0 flex items-center pl-4 pointer-events-none"
                style={{
                  opacity: Math.min(swipeOffset / SWIPE_THRESHOLD, 1),
                }}
              >
                <div className="flex items-center gap-2 text-primary">
                  <CornerUpLeft className="h-5 w-5" />
                  <span className="text-sm font-medium">Reply</span>
                </div>
              </div>
            )}

            {/* Avatar */}
            <div className="shrink-0">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-semibold text-primary shadow-sm">
                {message.sender.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Message Content */}
            <div className={cn(
              "flex-1 min-w-0 flex flex-col",
              isOwnMessage ? "items-end" : "items-start"
            )}>
              {/* Header */}
              <div className={cn(
                "flex items-baseline gap-2 mb-1.5 max-w-[70%]",
                isOwnMessage && "flex-row-reverse"
              )}>
                <span className="font-semibold text-sm text-foreground">{message.sender}</span>
                <span className="text-xs text-muted-foreground/80">
                  {formatDistanceToNow(message.ts, { addSuffix: true })}
                </span>
                {isEdited && (
                  <span className="text-xs text-muted-foreground/70 italic">(edited)</span>
                )}
                {isPinned && (
                  <Pin className="h-3 w-3 text-primary/70" />
                )}
              </div>

              {/* Message Bubble */}
              <div className={cn(
                'rounded-2xl px-4 py-2.5 shadow-sm transition-all duration-200 max-w-[70%]',
                isOwnMessage
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-accent/80 text-foreground rounded-bl-md'
              )}>
                {/* Reply Preview */}
                {replyToMessage && (
                  <div
                    className={cn(
                      "mb-2 pl-3 border-l-2 cursor-pointer rounded py-1.5 px-2 -mx-2 transition-colors",
                      isOwnMessage
                        ? "border-primary-foreground/30 bg-primary-foreground/10 hover:bg-primary-foreground/20"
                        : "border-primary/50 bg-background/50 hover:bg-background/70"
                    )}
                    onClick={() => onNavigateToReply?.(replyToMessage.id)}
                  >
                    <div className={cn(
                      "text-xs font-medium",
                      isOwnMessage ? "text-primary-foreground/90" : "text-muted-foreground"
                    )}>
                      Replying to <span className="font-semibold">{replyToMessage.sender}</span>
                    </div>
                    <div className={cn(
                      "text-xs truncate",
                      isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground/80"
                    )}>
                      {replyToMessage.body}
                    </div>
                  </div>
                )}

                {/* Message Body */}
                <div className="text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap">
                  {message.body}
                </div>

                {/* Forward indicator */}
                {message.forwardedFrom && (
                  <div className={cn(
                    "flex items-center gap-1 mt-1.5 text-xs",
                    isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    <Forward className="h-3 w-3" />
                    <span>Forwarded</span>
                  </div>
                )}
              </div>

              {/* Reactions - Positioned below the bubble */}
              {Object.keys(groupedReactions).length > 0 && (
                <div className={cn(
                  "flex flex-wrap gap-1 mt-1 max-w-[70%]",
                  isOwnMessage && "justify-end"
                )}>
                  {Object.values(groupedReactions).map((group) => (
                    <button
                      key={group.emoji}
                      onClick={() => handleReactionSelect(group.emoji)}
                      className={cn(
                        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full',
                        'transition-all duration-200',
                        'hover:scale-110 active:scale-95',
                        group.users.includes(currentUserId)
                          ? 'bg-primary/20'
                          : 'bg-transparent hover:bg-accent/30'
                      )}
                    >
                      <span className="text-lg">{group.emoji}</span>
                      {group.count > 1 && (
                        <span className="text-xs font-medium text-foreground/70">{group.count}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Focused Mode Quick Reactions */}
              {showFocusedReactions && (
                <div className="mt-3 flex items-center justify-center gap-2 animate-in zoom-in duration-200">
                  {quickReactions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReactionSelect(emoji)}
                      className={cn(
                        'w-12 h-12 rounded-full bg-accent hover:bg-accent/80',
                        'flex items-center justify-center text-2xl',
                        'transition-all duration-200 hover:scale-110',
                        'shadow-lg hover:shadow-xl'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowReactions(true)}
                    className="w-12 h-12 rounded-full bg-accent hover:bg-accent/80 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg hover:shadow-xl"
                  >
                    <Smile className="h-6 w-6 text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Reaction Picker */}
              <ReactionPicker
                trigger={<button className="hidden" />}
                onSelect={handleReactionSelect}
                open={showReactions}
                onOpenChange={setShowReactions}
              />

              {/* Read Receipts */}
              {isOwnMessage && readReceipts > 0 && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <CheckCheck className="h-3 w-3 text-primary" />
                  <span>Read by {readReceipts}</span>
                </div>
              )}
            </div>

            {/* Actions Menu */}
            {!showFocusedReactions && (
              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowReactions(!showReactions)}>
                      <Smile className="mr-2 h-4 w-4" />
                      Add Reaction
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onReply?.(message)}>
                      <Reply className="mr-2 h-4 w-4" />
                      Reply
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPin?.(message.id)}>
                      <Pin className="mr-2 h-4 w-4" />
                      {isPinned ? 'Unpin' : 'Pin'} Message
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onForward?.(message.id)}>
                      <Forward className="mr-2 h-4 w-4" />
                      Forward
                    </DropdownMenuItem>
                    {isOwnMessage && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEdit?.(message)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit Message
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete?.(message.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Message
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        {/* Context Menu */}
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setShowFocusedReactions(true)}>
            <Smile className="mr-2 h-4 w-4" />
            Add Reaction
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onReply?.(message)}>
            <Reply className="mr-2 h-4 w-4" />
            Reply
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onPin?.(message.id)}>
            <Pin className="mr-2 h-4 w-4" />
            {isPinned ? 'Unpin' : 'Pin'} Message
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onForward?.(message.id)}>
            <Forward className="mr-2 h-4 w-4" />
            Forward
          </ContextMenuItem>
          {isOwnMessage && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onEdit?.(message)}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Message
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onDelete?.(message.id)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Message
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
};

export default MessageRow;
