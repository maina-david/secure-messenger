import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VariableSizeList as List } from 'react-window';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Message, Reaction, ReadReceipt, PinnedMessage } from '../types';
import MessageRow from './MessageRow';
import MessageTimeSeparator from './MessageTimeSeparator';
import TypingIndicator from './TypingIndicator';
import { useAppDispatch } from '../store/hooks';
import { toast } from 'sonner';
import { isSameDay } from 'date-fns';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  chatId: number;
  reactions: Record<number, Reaction[]>;
  readReceipts: Record<number, ReadReceipt[]>;
  pinnedMessages: PinnedMessage[];
  replies: Record<number, number>;
  onScrollToMessage?: (messageId: number) => void;
  onReactionsChange?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isTyping?: boolean;
  typingUserName?: string;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  chatId,
  reactions,
  readReceipts,
  pinnedMessages,
  replies,
  onScrollToMessage,
  onReactionsChange,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  isTyping = false,
  typingUserName,
}) => {
  const dispatch = useAppDispatch();
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingTriggered = useRef(false);
  const hasUserScrolled = useRef(false);
  const [containerHeight, setContainerHeight] = useState(600);
  const itemSizeCache = useRef<Map<number, number>>(new Map());
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const pinnedMessageIds = new Set(pinnedMessages.map((pm) => pm.messageId));

  useEffect(() => {
    const measureHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    measureHeight();
    window.addEventListener('resize', measureHeight);
    return () => window.removeEventListener('resize', measureHeight);
  }, []);

  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      hasUserScrolled.current = false;
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [chatId]);

  const prevScrollOffset = useRef<number>(0);

  const handleScroll = useCallback(({ scrollOffset, scrollUpdateWasRequested }: { scrollOffset: number; scrollUpdateWasRequested: boolean }) => {
    const scrollingUp = scrollOffset < prevScrollOffset.current;

    if (Math.abs(scrollOffset - prevScrollOffset.current) > 5) {
      hasUserScrolled.current = true;
    }

    if (listRef.current && containerRef.current) {
      const listHeight = containerRef.current.clientHeight;
      const totalHeight = messages.length * 100;
      const isNearBottom = scrollOffset + listHeight >= totalHeight - 200;
      setShowScrollToBottom(!isNearBottom && messages.length > 0);
    }

    prevScrollOffset.current = scrollOffset;

    if (!hasMore || isLoading || loadingTriggered.current || !onLoadMore || !hasUserScrolled.current) {
      return;
    }

    if (scrollingUp && scrollOffset < 200 && scrollOffset > 0) {
      loadingTriggered.current = true;
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore, messages.length]);

  useEffect(() => {
    if (!isLoading) {
      loadingTriggered.current = false;
    }
  }, [isLoading]);

  const getItemSize = useCallback((index: number) => {
    if (itemSizeCache.current.has(index)) {
      return itemSizeCache.current.get(index)!;
    }

    const message = messages[index];
    const previousMessage = index > 0 ? messages[index - 1] : undefined;
    const showTimeSeparator = shouldShowTimeSeparator(message, previousMessage);

    const baseHeight = 80;
    const bodyLines = Math.ceil(message.body.length / 50);
    const timeSeparatorHeight = showTimeSeparator ? 40 : 0;
    const replyHeight = replies[message.id] ? 40 : 0;
    const reactionsHeight = (reactions[message.id]?.length || 0) > 0 ? 30 : 0;

    const estimatedHeight = baseHeight + (bodyLines * 20) + timeSeparatorHeight + replyHeight + reactionsHeight;
    return Math.max(estimatedHeight, 60);
  }, [messages, replies, reactions]);

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    window.dispatchEvent(
      new CustomEvent('edit-message', { detail: message })
    );
  };

  const handleDelete = async (messageId: number) => {
    try {
      const response = await window.electronAPI.deleteMessage(messageId);
      if (response.success) {
        toast.success('Message deleted');
      } else {
        toast.error(response.error || 'Failed to delete message');
      }
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    window.dispatchEvent(
      new CustomEvent('reply-to-message', { detail: message })
    );
  };

  const handlePin = async (messageId: number) => {
    const isPinned = pinnedMessageIds.has(messageId);
    try {
      if (isPinned) {
        const response = await window.electronAPI.unpinMessage(messageId, chatId);
        if (response.success) {
          toast.success('Message unpinned');
        } else {
          toast.error(response.error || 'Failed to unpin message');
        }
      } else {
        const response = await window.electronAPI.pinMessage(
          messageId,
          chatId,
          currentUserId
        );
        if (response.success) {
          toast.success('Message pinned');
        } else {
          toast.error(response.error || 'Failed to pin message');
        }
      }
    } catch (error) {
      toast.error('Failed to pin/unpin message');
    }
  };

  const handleForward = (messageId: number) => {
    window.dispatchEvent(
      new CustomEvent('forward-message', { detail: { messageId } })
    );
  };

  const handleReact = async (messageId: number, emoji: string) => {
    try {
      const messageReactions = reactions[messageId] || [];
      const existingReaction = messageReactions.find(
        (r) => r.userId === currentUserId && r.emoji === emoji
      );

      if (existingReaction) {
        const response = await window.electronAPI.removeReaction(
          messageId,
          currentUserId,
          emoji
        );
        if (!response.success) {
          toast.error(response.error || 'Failed to remove reaction');
        } else {
          onReactionsChange?.();
        }
      } else {
        const response = await window.electronAPI.addReaction(
          messageId,
          chatId,
          currentUserId,
          emoji
        );
        if (!response.success) {
          toast.error(response.error || 'Failed to add reaction');
        } else {
          onReactionsChange?.();
        }
      }
    } catch (error) {
      toast.error('Failed to react to message');
    }
  };

  const handleNavigateToReply = (messageId: number) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onScrollToMessage?.(messageId);
    }
  };

  const getReplyToMessage = (messageId: number): Message | null => {
    const replyToId = replies[messageId];
    if (!replyToId) return null;
    return messages.find((m) => m.id === replyToId) || null;
  };

  const shouldShowTimeSeparator = (currentMessage: Message, previousMessage?: Message): boolean => {
    if (!previousMessage) return true;
    return !isSameDay(new Date(currentMessage.ts), new Date(previousMessage.ts));
  };

  const scrollToBottom = useCallback(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
      setShowScrollToBottom(false);
    }
  }, [messages.length]);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const message = messages[index];
    const messageReactions = reactions[message.id] || [];
    const messageReceipts = readReceipts[message.id] || [];
    const isPinned = pinnedMessageIds.has(message.id);
    const replyToMessage = getReplyToMessage(message.id);
    const previousMessage = index > 0 ? messages[index - 1] : undefined;
    const showTimeSeparator = shouldShowTimeSeparator(message, previousMessage);

    return (
      <div style={style}>
        {showTimeSeparator && <MessageTimeSeparator timestamp={message.ts} />}
        <div id={`message-${message.id}`} className="px-4">
          <MessageRow
            message={message}
            currentUserId={currentUserId}
            reactions={messageReactions}
            readReceipts={messageReceipts.length}
            isPinned={isPinned}
            replyToMessage={replyToMessage}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReply={handleReply}
            onPin={handlePin}
            onForward={handleForward}
            onReact={handleReact}
            onNavigateToReply={handleNavigateToReply}
          />
        </div>
      </div>
    );
  }, [messages, reactions, readReceipts, pinnedMessageIds, replies, currentUserId]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-muted-foreground">
        <div className="text-center">
          <p className="mb-2 text-lg font-medium">No messages yet</p>
          <p className="text-sm">Start a conversation by sending a message below</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden"
    >
      {isLoading && hasMore && (
        <div className="absolute z-10 transform -translate-x-1/2 top-2 left-1/2">
          <div className="px-4 py-2 border rounded-lg shadow-lg bg-background">
            <p className="text-sm text-muted-foreground">Loading more messages...</p>
          </div>
        </div>
      )}
      <List
        ref={listRef}
        height={containerHeight}
        itemCount={messages.length}
        itemSize={getItemSize}
        width="100%"
        onScroll={handleScroll}
        className="scrollbar-thin scrollbar-thumb-border scrollbar-track-background"
      >
        {Row}
      </List>
      {isTyping && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-2 bg-linear-to-t from-background to-transparent">
          <TypingIndicator userName={typingUserName} />
        </div>
      )}
      {showScrollToBottom && (
        <Button
          onClick={scrollToBottom}
          className="absolute z-20 p-2 shadow-lg bottom-4 right-4 rounded-full h-10 w-10"
          size="icon"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
};

export default MessageList;
