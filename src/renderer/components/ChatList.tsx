import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchChats, markChatAsRead } from '../store/chatsSlice';
import { selectChat } from '../store/messagesSlice';
import { Chat, Message } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import ContactsDialog from './ContactsDialog';

interface ChatListProps {
  onChatSelect: (chatId: number) => void;
}

const ChatList: React.FC<ChatListProps> = ({ onChatSelect }) => {
  const dispatch = useAppDispatch();
  const { chats, loading, hasMore } = useAppSelector((state) => state.chats);
  const selectedChatId = useAppSelector((state) => state.messages.selectedChatId);
  const [lastMessages, setLastMessages] = useState<Record<number, Message>>({});
  const [showContactsDialog, setShowContactsDialog] = useState(false);
  const loadedChatsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    dispatch(fetchChats({ reset: true }));
  }, [dispatch]);

  // Create a stable array of chat IDs to avoid infinite loops
  const chatIds = useMemo(() => chats.map(chat => chat.id).join(','), [chats]);

  // Load last messages for all chats in a single batch call (optimized!)
  useEffect(() => {
    const loadLastMessages = async () => {
      // Get only the chat IDs we haven't loaded yet
      const newChatIds = chats
        .filter(chat => !loadedChatsRef.current.has(chat.id))
        .map(chat => chat.id);

      if (newChatIds.length === 0) return;

      try {
        // Single batch API call instead of N individual calls!
        const response = await window.electronAPI.getLastMessagesBatch(newChatIds);

        if (response.success && response.data) {
          setLastMessages(prev => ({ ...prev, ...response.data }));

          // Mark these chats as loaded
          newChatIds.forEach(id => loadedChatsRef.current.add(id));
        }
      } catch (error) {
        console.error('Failed to load last messages batch:', error);
      }
    };

    if (chats.length > 0) {
      loadLastMessages();
    }
  }, [chatIds]);

  const handleChatClick = useCallback(async (chat: Chat) => {
    dispatch(selectChat(chat.id));
    onChatSelect(chat.id);
    const response = await window.electronAPI.markChatRead(chat.id);
    if (response.success) {
      dispatch(markChatAsRead(chat.id));
    }
  }, [dispatch, onChatSelect]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 168) { // Less than a week
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const chat = chats[index];
    const isSelected = chat.id === selectedChatId;
    const lastMessage = lastMessages[chat.id];

    // Format last message preview
    const getMessagePreview = () => {
      if (!lastMessage) {
        return 'No messages yet';
      }

      if (lastMessage.isDeleted) {
        return 'Message deleted';
      }

      // Truncate long messages
      const maxLength = 35;
      const preview = lastMessage.body.length > maxLength
        ? `${lastMessage.body.substring(0, maxLength)}...`
        : lastMessage.body;

      return preview;
    };

    return (
      <div
        style={style}
        onClick={() => handleChatClick(chat)}
        className={cn(
          "group relative cursor-pointer px-5 py-3.5 transition-all duration-200",
          isSelected
            ? "bg-[hsl(var(--chat-active))]"
            : "hover:bg-[hsl(var(--chat-hover))]"
        )}
      >
        <div className="flex items-center gap-3.5">
          {/* Avatar */}
          <div className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-semibold text-white transition-all duration-200",
            isSelected
              ? "bg-primary ring-2 ring-primary/30"
              : "bg-linear-to-br from-primary/80 to-primary/60 group-hover:from-primary group-hover:to-primary/80"
          )}>
            {chat.title.charAt(0).toUpperCase()}
          </div>

          {/* Chat info */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h3 className={cn(
                "truncate text-[15px] transition-colors",
                chat.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90"
              )}>
                {chat.title}
              </h3>
              <span className={cn(
                "shrink-0 text-[12px] transition-colors",
                chat.unreadCount > 0 ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {formatTime(chat.lastMessageAt)}
              </span>
            </div>

            {/* Bottom row with unread badge */}
            <div className="flex items-center justify-between gap-2">
              <p className={cn(
                "truncate text-[13px]",
                lastMessage?.isDeleted ? "italic text-muted-foreground/70" : "text-muted-foreground"
              )}>
                {getMessagePreview()}
              </p>
              {chat.unreadCount > 0 && (
                <Badge
                  variant="default"
                  className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-[11px] font-semibold shadow-md"
                >
                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
        )}
      </div>
    );
  };

  const loadMoreChats = useCallback(() => {
    if (!loading && hasMore) {
      dispatch(fetchChats({ reset: false }));
    }
  }, [dispatch, loading, hasMore]);

  const handleContactSelect = useCallback((chatId: number) => {
    // Switch to the newly created chat
    dispatch(selectChat(chatId));
    onChatSelect(chatId);
    // Refresh chats list to show the new chat
    dispatch(fetchChats({ reset: true }));
  }, [dispatch, onChatSelect]);

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 backdrop-blur-custom">
        <div>
          <h2 className="text-[17px] font-semibold text-foreground">Messages</h2>
          <p className="text-[12px] text-muted-foreground">{chats.length} conversations</p>
        </div>
        <Button
          onClick={() => setShowContactsDialog(true)}
          size="sm"
          className="h-8 w-8 rounded-lg p-0"
          title="New Chat"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>

      {/* Chat list */}
      {chats.length === 0 && !loading ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="mb-1 text-sm font-medium text-foreground/80">No conversations yet</p>
          <p className="text-xs text-muted-foreground">Click "Seed Database" to generate test data</p>
        </div>
      ) : (
        <List
          height={window.innerHeight - 130}
          itemCount={chats.length}
          itemSize={80}
          width="100%"
          onItemsRendered={({ visibleStopIndex }) => {
            if (visibleStopIndex >= chats.length - 10) {
              loadMoreChats();
            }
          }}
        >
          {Row}
        </List>
      )}

      {loading && (
        <div className="bg-card/80 px-4 py-2.5 text-center text-xs text-muted-foreground backdrop-blur-sm">
          Loading more conversations...
        </div>
      )}

      {/* Contacts Dialog */}
      <ContactsDialog
        open={showContactsDialog}
        onOpenChange={setShowContactsDialog}
        onContactSelect={handleContactSelect}
      />
    </div>
  );
};

export default ChatList;
