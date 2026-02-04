import React, { useEffect, useRef, useState } from 'react';
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
  isTyping = false,
  typingUserName,
}) => {
  const dispatch = useAppDispatch();
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const pinnedMessageIds = new Set(pinnedMessages.map((pm) => pm.messageId));

  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

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
    // Emit event to MessageInput to show reply preview
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
      // Check if user already reacted with this emoji
      const messageReactions = reactions[messageId] || [];
      const existingReaction = messageReactions.find(
        (r) => r.userId === currentUserId && r.emoji === emoji
      );

      if (existingReaction) {
        // Remove reaction
        const response = await window.electronAPI.removeReaction(
          messageId,
          currentUserId,
          emoji
        );
        if (!response.success) {
          toast.error(response.error || 'Failed to remove reaction');
        } else {
          // Reload reactions after successful removal
          onReactionsChange?.();
        }
      } else {
        // Add reaction
        const response = await window.electronAPI.addReaction(
          messageId,
          chatId,
          currentUserId,
          emoji
        );
        if (!response.success) {
          toast.error(response.error || 'Failed to add reaction');
        } else {
          // Reload reactions after successful addition
          onReactionsChange?.();
        }
      }
    } catch (error) {
      toast.error('Failed to react to message');
    }
  };

  const handleNavigateToReply = (messageId: number) => {
    // Find the message element and scroll to it
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight the message briefly
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

  return (
    <div
      ref={listRef}
      className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-background scroll-smooth"
    >
      <div className="py-4 space-y-1">
        {messages.map((message, index) => {
          const messageReactions = reactions[message.id] || [];
          const messageReceipts = readReceipts[message.id] || [];
          const isPinned = pinnedMessageIds.has(message.id);
          const replyToMessage = getReplyToMessage(message.id);
          const previousMessage = index > 0 ? messages[index - 1] : undefined;
          const showTimeSeparator = shouldShowTimeSeparator(message, previousMessage);

          return (
            <React.Fragment key={message.id}>
              {showTimeSeparator && <MessageTimeSeparator timestamp={message.ts} />}
              <div
                id={`message-${message.id}`}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
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
            </React.Fragment>
          );
        })}

        {isTyping && <TypingIndicator userName={typingUserName} />}
      </div>
    </div>
  );
};

export default MessageList;
