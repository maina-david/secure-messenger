import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { VariableSizeList as List, ListChildComponentProps } from 'react-window';
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

interface ListItem {
  type: 'separator' | 'message' | 'typing';
  message?: Message;
  timestamp?: number;
}

// Height estimations for different item types
const ESTIMATED_MESSAGE_HEIGHT = 80;
const TIME_SEPARATOR_HEIGHT = 40;
const TYPING_INDICATOR_HEIGHT = 60;

const VirtualizedMessageList: React.FC<MessageListProps> = ({
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
  const listRef = useRef<List>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const loadingTriggered = useRef(false);

  // Height cache for variable-sized items
  const sizeMap = useRef<Record<number, number>>({});
  const setSize = useCallback((index: number, size: number) => {
    sizeMap.current = { ...sizeMap.current, [index]: size };
    listRef.current?.resetAfterIndex(index);
  }, []);

  const pinnedMessageIds = useMemo(
    () => new Set(pinnedMessages.map((pm) => pm.messageId)),
    [pinnedMessages]
  );

  // Build list items with time separators
  const listItems = useMemo((): ListItem[] => {
    const items: ListItem[] = [];

    messages.forEach((message, index) => {
      const previousMessage = index > 0 ? messages[index - 1] : undefined;
      const showSeparator =
        !previousMessage ||
        !isSameDay(new Date(message.ts), new Date(previousMessage.ts));

      if (showSeparator) {
        items.push({ type: 'separator', timestamp: message.ts });
      }
      items.push({ type: 'message', message });
    });

    if (isTyping) {
      items.push({ type: 'typing' });
    }

    return items;
  }, [messages, isTyping]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (listItems.length > 0 && listRef.current) {
      listRef.current.scrollToItem(listItems.length - 1, 'end');
    }
  }, [listItems.length]);

  // Get item size with caching
  const getItemSize = useCallback(
    (index: number): number => {
      if (sizeMap.current[index]) {
        return sizeMap.current[index];
      }

      const item = listItems[index];
      if (!item) return ESTIMATED_MESSAGE_HEIGHT;

      if (item.type === 'separator') {
        return TIME_SEPARATOR_HEIGHT;
      } else if (item.type === 'typing') {
        return TYPING_INDICATOR_HEIGHT;
      }

      // Estimate message height based on content
      const message = item.message;
      if (!message) return ESTIMATED_MESSAGE_HEIGHT;

      const hasReactions = reactions[message.id]?.length > 0;
      const hasReplies = !!replies[message.id];
      const bodyLength = message.body.length;

      let height = 60; // Base height
      height += Math.ceil(bodyLength / 50) * 20; // Add height for text
      if (hasReactions) height += 30;
      if (hasReplies) height += 40;

      return height;
    },
    [listItems, reactions, replies]
  );

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    window.dispatchEvent(new CustomEvent('edit-message', { detail: message }));
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
    // Find the index of the message in listItems
    const index = listItems.findIndex(
      (item) => item.type === 'message' && item.message?.id === messageId
    );
    if (index !== -1 && listRef.current) {
      listRef.current.scrollToItem(index, 'center');
      onScrollToMessage?.(messageId);
    }
  };

  const getReplyToMessage = (messageId: number): Message | null => {
    const replyToId = replies[messageId];
    if (!replyToId) return null;
    return messages.find((m) => m.id === replyToId) || null;
  };

  // Row renderer for react-window
  const Row = ({ index, style }: ListChildComponentProps) => {
    const item = listItems[index];
    if (!item) return null;

    if (item.type === 'separator') {
      return (
        <div style={style}>
          <MessageTimeSeparator timestamp={item.timestamp!} />
        </div>
      );
    }

    if (item.type === 'typing') {
      return (
        <div style={style}>
          <TypingIndicator userName={typingUserName} />
        </div>
      );
    }

    const message = item.message!;
    const messageReactions = reactions[message.id] || [];
    const messageReceipts = readReceipts[message.id] || [];
    const isPinned = pinnedMessageIds.has(message.id);
    const replyToMessage = getReplyToMessage(message.id);

    return (
      <div style={style} id={`message-${message.id}`}>
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
    );
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">No messages yet</p>
          <p className="text-sm">Start a conversation by sending a message below</p>
        </div>
      </div>
    );
  }

  // Handle infinite scroll - load more when scrolled near top
  const handleItemsRendered = useCallback(
    ({ visibleStartIndex }: { visibleStartIndex: number }) => {
      // Trigger load when we're within 5 items of the top
      if (
        visibleStartIndex < 5 &&
        hasMore &&
        !isLoading &&
        !loadingTriggered.current &&
        onLoadMore
      ) {
        loadingTriggered.current = true;
        onLoadMore();
      }
    },
    [hasMore, isLoading, onLoadMore]
  );

  // Reset loading trigger when loading completes
  useEffect(() => {
    if (!isLoading) {
      loadingTriggered.current = false;
    }
  }, [isLoading]);

  return (
    <div className="flex-1 relative">
      {isLoading && hasMore && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-background border rounded-lg px-4 py-2 shadow-lg">
            <p className="text-sm text-muted-foreground">Loading more messages...</p>
          </div>
        </div>
      )}
      <List
        ref={listRef}
        outerRef={outerRef}
        height={window.innerHeight - 200} // Adjust based on your layout
        itemCount={listItems.length}
        itemSize={getItemSize}
        width="100%"
        overscanCount={5} // Render 5 extra items above/below viewport
        onItemsRendered={handleItemsRendered}
        className="scrollbar-thin scrollbar-thumb-border scrollbar-track-background scroll-smooth"
      >
        {Row}
      </List>
    </div>
  );
};

export default VirtualizedMessageList;
