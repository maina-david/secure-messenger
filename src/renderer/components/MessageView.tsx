import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VariableSizeList as List } from 'react-window';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchMessages, searchMessages, addMessage } from '../store/messagesSlice';
import { markChatAsRead } from '../store/chatsSlice';
import MessageInput from './MessageInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, X, MessageSquare, ChevronDown } from 'lucide-react';

interface MessageRowData {
  messages: any[];
  formatTime: (timestamp: number) => string;
  formatDate: (timestamp: number) => string;
}

const MessageView: React.FC = () => {
  const dispatch = useAppDispatch();
  const selectedChatId = useAppSelector((state) => state.messages.selectedChatId);
  const messages = useAppSelector((state) =>
    selectedChatId ? state.messages.messagesByChatId[selectedChatId] || [] : []
  );
  const hasMore = useAppSelector((state) =>
    selectedChatId ? state.messages.hasMore[selectedChatId] : false
  );
  const loading = useAppSelector((state) => state.messages.loading);
  const selectedChat = useAppSelector((state) =>
    state.chats.chats.find(chat => chat.id === selectedChatId)
  );

  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef<List>(null);
  const [listHeight, setListHeight] = useState(window.innerHeight - 200);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    if (selectedChatId) {
      dispatch(fetchMessages({ chatId: selectedChatId, reset: true }));
      dispatch(markChatAsRead(selectedChatId));
      setSearchQuery('');
      // Scroll to bottom when new chat is selected
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollToItem(messages.length - 1, 'end');
        }
      }, 100);
    }
  }, [selectedChatId, dispatch]);

  useEffect(() => {
    const handleResize = () => {
      setListHeight(window.innerHeight - 200);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages update (new message received)
    if (messages.length > 0 && listRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollToItem(messages.length - 1, 'end');
        }
      });
    }
  }, [messages.length]);

  const loadOlderMessages = useCallback(() => {
    if (selectedChatId && !loading && hasMore) {
      dispatch(fetchMessages({ chatId: selectedChatId, reset: false }));
    }
  }, [selectedChatId, loading, hasMore, dispatch]);

  const handleSearch = useCallback(() => {
    if (selectedChatId && searchQuery.trim()) {
      dispatch(searchMessages({ chatId: selectedChatId, query: searchQuery }));
    } else if (selectedChatId && !searchQuery.trim()) {
      dispatch(fetchMessages({ chatId: selectedChatId, reset: true }));
    }
  }, [selectedChatId, searchQuery, dispatch]);

  const scrollToBottom = useCallback(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
      setShowScrollButton(false);
    }
  }, [messages.length]);

  const handleScroll = useCallback(({ scrollOffset, scrollUpdateWasRequested }: { scrollOffset: number; scrollUpdateWasRequested: boolean }) => {
    if (!scrollUpdateWasRequested && messages.length > 0) {
      const lastItemOffset = messages.length * 80; // Approximate
      const isNearBottom = scrollOffset > lastItemOffset - listHeight - 200;
      setShowScrollButton(!isNearBottom);
    }
  }, [messages.length, listHeight]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!selectedChatId || !message.trim()) return;

    try {
      // Send message to backend
      const response = await window.electronAPI.sendMessage(
        selectedChatId,
        'You', // Current user name
        message.trim()
      );

      if (response.success && response.data) {
        // Add message to Redux store immediately for instant UI update
        // The useEffect watching messages.length will handle scrolling
        dispatch(addMessage(response.data));
      } else {
        toast.error('Failed to send message', {
          description: response.error || 'Please try again',
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message', {
        description: 'Network error occurred',
      });
    }
  }, [selectedChatId, dispatch]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const getItemSize = (index: number) => {
    const message = messages[index];
    const showDate = index === 0 ||
      new Date(messages[index - 1].ts).toDateString() !== new Date(message.ts).toDateString();

    const baseHeight = 65;
    const dateHeaderHeight = showDate ? 40 : 0;
    const bodyHeight = Math.ceil(message.body.length / 40) * 22;

    return Math.min(baseHeight + dateHeaderHeight + bodyHeight, 250);
  };

  const MessageRow = ({ index, style, data }: { index: number; style: React.CSSProperties; data: MessageRowData }) => {
    const { messages, formatTime, formatDate } = data;
    const message = messages[index];
    const showDate = index === 0 ||
      new Date(messages[index - 1].ts).toDateString() !== new Date(message.ts).toDateString();

    const isOutgoing = message.sender === 'You';

    return (
      <div style={style} className="px-4">
        {showDate && (
          <div className="mb-4 mt-2 flex items-center justify-center">
            <div className="rounded-full bg-muted/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              {formatDate(message.ts)}
            </div>
          </div>
        )}
        <div className={`mb-2 flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
          <div className="flex max-w-[70%] flex-col gap-1">
            {!isOutgoing && (
              <span className="ml-3 text-xs font-medium text-primary">{message.sender}</span>
            )}
            <div
              className={`message-bubble group relative rounded-2xl px-4 py-2.5 shadow-sm transition-all duration-200 hover:shadow-md ${
                isOutgoing
                  ? 'rounded-br-md bg-primary text-primary-foreground'
                  : 'rounded-bl-md bg-[hsl(var(--message-incoming))] text-foreground'
              }`}
            >
              {message.isDeleted ? (
                <p className="wrap-break-word text-[14px] italic leading-relaxed opacity-60">
                  This message was deleted
                </p>
              ) : (
                <p className="wrap-break-word text-[14px] leading-relaxed">{message.body}</p>
              )}
              <div className={`mt-1 flex items-center justify-end gap-1.5 text-[11px] ${
                isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
              }`}>
                <span>{formatTime(message.ts)}</span>
                {message.editedAt && !message.isDeleted && (
                  <span className="italic">edited</span>
                )}
                {isOutgoing && (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 15" fill="none">
                    <path d="M5.5 7.5L7.5 9.5L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9.5 7.5L11.5 9.5L15 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!selectedChatId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <MessageSquare className="mb-4 h-20 w-20 text-muted-foreground/30" strokeWidth={1.5} />
        <p className="text-lg font-medium text-foreground/80">Select a chat to start messaging</p>
        <p className="mt-2 text-sm text-muted-foreground">Choose a conversation from the list on the left</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between bg-card px-5 py-3.5 backdrop-blur-custom">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/70 font-semibold text-white">
            {selectedChat?.title.charAt(0).toUpperCase() || 'C'}
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">{selectedChat?.title || 'Chat'}</h2>
            <p className="text-[12px] text-muted-foreground">last seen recently</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => setSearchQuery(prev => prev ? '' : 'search')}
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>

      {/* Search bar (expandable) */}
      {searchQuery !== '' && (
        <div className="bg-card/80 p-3 backdrop-blur-sm">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search in this chat..."
                value={searchQuery === 'search' ? '' : searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-9 border-0 bg-background/50 pl-9 text-sm"
                autoFocus
              />
            </div>
            <Button onClick={handleSearch} size="sm" className="h-9">
              Search
            </Button>
            <Button
              onClick={() => {
                setSearchQuery('');
                if (selectedChatId) {
                  dispatch(fetchMessages({ chatId: selectedChatId, reset: true }));
                }
              }}
              variant="ghost"
              size="icon"
              className="h-9 w-9"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Messages - Virtualized */}
      <div className="relative flex-1 overflow-hidden">
        {hasMore && searchQuery === '' && (
          <div className="absolute left-0 right-0 top-0 z-10 flex justify-center p-2">
            <Button
              onClick={loadOlderMessages}
              disabled={loading}
              variant="secondary"
              size="sm"
              className="h-8 rounded-full bg-card/95 px-4 text-xs shadow-lg backdrop-blur-sm hover:bg-card"
            >
              {loading ? (
                <>Loading...</>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3.5 w-3.5" />
                  Load older messages
                </>
              )}
            </Button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm">No messages in this chat yet</p>
              <p className="mt-1 text-xs">Start the conversation!</p>
            </div>
          </div>
        ) : (
          <List
            ref={listRef}
            height={listHeight}
            itemCount={messages.length}
            itemSize={getItemSize}
            width="100%"
            className="pt-12 pb-8"
            style={{ paddingBottom: '60px' }}
            onScroll={handleScroll}
            itemData={{
              messages,
              formatTime,
              formatDate,
            }}
          >
            {MessageRow}
          </List>
        )}

        {/* Scroll to bottom button */}
        {showScrollButton && messages.length > 0 && (
          <div className="absolute bottom-6 right-6 z-10">
            <Button
              onClick={scrollToBottom}
              size="icon"
              className="h-11 w-11 rounded-full bg-primary shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        chatId={selectedChatId}
        onSendMessage={handleSendMessage}
        disabled={!selectedChatId}
      />
    </div>
  );
};

export default MessageView;
