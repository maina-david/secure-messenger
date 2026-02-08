import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, Download, Search, Users, MoreVertical, X, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import PinnedMessageBanner from './PinnedMessageBanner';
import EditMessageDialog from './EditMessageDialog';
import ForwardDialog from './ForwardDialog';
import ExportDialog from './ExportDialog';
import SearchBar from './SearchBar';
import SearchResults from './SearchResults';
import GroupChatDialog from './GroupChatDialog';
import PollCreator from './PollCreator';
import ScheduleMessageDialog from './ScheduleMessageDialog';
import SettingsPanel from './SettingsPanel';
import CommandPalette from './CommandPalette';
import { Message, Chat, PinnedMessage, Reaction, ReadReceipt } from '../types';

interface ChatViewProps {
  chatId: number | null;
  currentUserId: string;
  className?: string;
}

const ChatView: React.FC<ChatViewProps> = ({ chatId, currentUserId, className }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [reactions, setReactions] = useState<Record<number, Reaction[]>>({});
  const [readReceipts, setReadReceipts] = useState<Record<number, ReadReceipt[]>>({});
  const [replies, setReplies] = useState<Record<number, number>>({});

  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardingMessageId, setForwardingMessageId] = useState<number | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasUserInteracted = useRef(false);

  useEffect(() => {
    if (!chatId) return;

    hasUserInteracted.current = false;

    const loadChatData = async () => {
      try {
        const messagesResponse = await window.electronAPI.getMessages(chatId, 50, 0);
        if (messagesResponse.success && messagesResponse.data) {
          setMessages(messagesResponse.data);
          setHasMoreMessages(messagesResponse.data.length === 50);
        }

        const chatsResponse = await window.electronAPI.getChats(100, 0);
        if (chatsResponse.success && chatsResponse.data) {
          setChats(chatsResponse.data);
          const chat = chatsResponse.data.find((c) => c.id === chatId);
          setCurrentChat(chat || null);
        }

        const pinnedResponse = await window.electronAPI.getPinnedMessages(chatId);
        if (pinnedResponse.success && pinnedResponse.data) {
          setPinnedMessages(pinnedResponse.data);
        }

        const reactionsResponse = await window.electronAPI.getReactionsByChat(chatId);
        if (reactionsResponse.success && reactionsResponse.data) {
          setReactions(reactionsResponse.data);
        }

        const receiptsResponse = await window.electronAPI.getReadReceiptsByChat(chatId);
        if (receiptsResponse.success && receiptsResponse.data) {
          setReadReceipts(receiptsResponse.data);
        }

        const repliesMap: Record<number, number> = {};
        for (const message of messagesResponse.data || []) {
          const replyResponse = await window.electronAPI.getMessageReply(message.id);
          if (replyResponse.success && replyResponse.data) {
            repliesMap[message.id] = replyResponse.data;
          }
        }
        setReplies(repliesMap);
        await window.electronAPI.markChatRead(chatId);
      } catch (error) {
        console.error('Failed to load chat data:', error);
        toast.error('Failed to load chat', { duration: 3000 });
      }
    };

    loadChatData();
  }, [chatId]);

  // Reload reactions when they change
  const reloadReactions = useCallback(async () => {
    if (!chatId) return;

    try {
      const reactionsResponse = await window.electronAPI.getReactionsByChat(chatId);
      if (reactionsResponse.success && reactionsResponse.data) {
        setReactions(reactionsResponse.data);
      }
    } catch (error) {
      console.error('Failed to reload reactions:', error);
    }
  }, [chatId]);

  // Load older messages (infinite scroll)
  const loadOlderMessages = useCallback(async () => {
    if (!chatId || isLoadingMore || !hasMoreMessages || messages.length === 0) return;

    setIsLoadingMore(true);
    try {
      // Get timestamp of oldest message for cursor-based pagination
      const oldestTimestamp = messages[0].ts;
      const messagesResponse = await window.electronAPI.getMessagesBefore(chatId, oldestTimestamp, 50);

      if (messagesResponse.success && messagesResponse.data) {
        const olderMessages = messagesResponse.data;
        // Prepend older messages (they come in DESC order from DB)
        setMessages((prev) => [...olderMessages, ...prev]);
        setHasMoreMessages(olderMessages.length === 50);

        // Load replies for new messages
        const repliesMap: Record<number, number> = { ...replies };
        for (const message of olderMessages) {
          const replyResponse = await window.electronAPI.getMessageReply(message.id);
          if (replyResponse.success && replyResponse.data) {
            repliesMap[message.id] = replyResponse.data;
          }
        }
        setReplies(repliesMap);
      }
    } catch (error) {
      console.error('Failed to load older messages:', error);
      toast.error('Failed to load older messages', { duration: 3000 });
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, messages, isLoadingMore, hasMoreMessages, replies]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMoreMessages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoadingMore && hasMoreMessages && hasUserInteracted.current) {
          loadOlderMessages();
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [loadOlderMessages, hasMoreMessages, isLoadingMore]);

  useEffect(() => {
    const handleScroll = () => {
      hasUserInteracted.current = true;
    };

    const messageContainer = document.querySelector('[data-message-container]');
    if (messageContainer) {
      messageContainer.addEventListener('scroll', handleScroll, { once: true });
      return () => messageContainer.removeEventListener('scroll', handleScroll);
    }
  }, [chatId]);

  // Listen to custom events from MessageList
  useEffect(() => {
    const handleForwardEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ messageId: number }>;
      setForwardingMessageId(customEvent.detail.messageId);
    };

    const handleEditEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Message>;
      setEditingMessage(customEvent.detail);
    };

    window.addEventListener('forward-message', handleForwardEvent);
    window.addEventListener('edit-message', handleEditEvent);

    return () => {
      window.removeEventListener('forward-message', handleForwardEvent);
      window.removeEventListener('edit-message', handleEditEvent);
    };
  }, []);

  // Message handlers
  const handleSendMessage = useCallback(
    async (message: string, replyToMessageId?: number) => {
      if (!chatId) return;

      try {
        const response = await window.electronAPI.sendMessage(chatId, currentUserId, message);
        if (response.success && response.data) {
          setMessages((prev) => [...prev, response.data!]);

          // Set reply relationship if replying
          if (replyToMessageId) {
            await window.electronAPI.setMessageReply(response.data.id, replyToMessageId);
          }
        } else {
          toast.error(response.error || 'Failed to send message', { duration: 3000 });
        }
      } catch (error) {
        console.error('Send message error:', error);
        toast.error('Failed to send message', { duration: 3000 });
      }
    },
    [chatId, currentUserId]
  );

  const handleEditMessage = useCallback(async (messageId: number, newBody: string) => {
    try {
      const response = await window.electronAPI.editMessage(messageId, newBody);
      if (response.success && response.data) {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? response.data! : msg))
        );
        toast.success('Message updated', { duration: 2000 });
      } else {
        toast.error(response.error || 'Failed to update message', { duration: 3000 });
      }
    } catch (error) {
      console.error('Edit message error:', error);
      toast.error('Failed to update message', { duration: 3000 });
    }
  }, []);


  const handlePinMessage = useCallback(
    async (messageId: number) => {
      if (!chatId) return;

      try {
        const isPinned = pinnedMessages.some((pm) => pm.messageId === messageId);

        if (isPinned) {
          const response = await window.electronAPI.unpinMessage(messageId, chatId);
          if (response.success) {
            setPinnedMessages((prev) => prev.filter((pm) => pm.messageId !== messageId));
            toast.success('Message unpinned', { duration: 2000 });
          }
        } else {
          const response = await window.electronAPI.pinMessage(
            messageId,
            chatId,
            currentUserId
          );
          if (response.success && response.data) {
            setPinnedMessages((prev) => [...prev, response.data!]);
            toast.success('Message pinned', { duration: 2000 });
          }
        }
      } catch (error) {
        console.error('Pin message error:', error);
        toast.error('Failed to pin/unpin message', { duration: 3000 });
      }
    },
    [chatId, currentUserId, pinnedMessages]
  );


  const handleNavigateToMessage = useCallback((messageId: number) => {
    const event = new CustomEvent('navigate-to-message', { detail: messageId });
    window.dispatchEvent(event);
  }, []);

  const handleSearchResults = useCallback((results: Message[]) => {
    setSearchResults(results);
    setCurrentSearchIndex(0);
    if (results.length > 0) {
      handleNavigateToMessage(results[0].id);
    } else {
      setSearchResults([]);
    }
  }, [handleNavigateToMessage]);

  const handleNavigateSearchResult = useCallback((index: number) => {
    setCurrentSearchIndex(index);
    if (searchResults[index]) {
      handleNavigateToMessage(searchResults[index].id);
    }
  }, [searchResults, handleNavigateToMessage]);

  const handleSearchResultClick = useCallback((index: number) => {
    handleNavigateSearchResult(index);
  }, [handleNavigateSearchResult]);

  const handleCommandChatSelect = useCallback((selectedChatId: number) => {
    const event = new CustomEvent('switch-chat', { detail: selectedChatId });
    window.dispatchEvent(event);
  }, []);

  const handleCommandAction = useCallback((action: string) => {
    switch (action) {
      case 'new-group':
        setShowGroupDialog(true);
        break;
      case 'search':
        setShowSearchBar(true);
        break;
      case 'export':
        setShowExportDialog(true);
        break;
      case 'poll':
        setShowPollCreator(true);
        break;
      case 'schedule':
        setShowScheduleDialog(true);
        break;
      case 'settings':
        setShowSettings(true);
        break;
    }
  }, []);

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">Select a chat to start messaging</p>
          <p className="text-sm">Choose a conversation from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-background ${className || ''}`}>
      {/* Header */}
      <div className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            {currentChat?.type === 'group' ? (
              <Users className="h-5 w-5 text-primary" />
            ) : (
              <span className="font-medium text-primary">
                {currentChat?.title?.charAt(0).toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div>
            <h2 className="font-semibold text-base">{currentChat?.title || 'Chat'}</h2>
            {currentChat?.type === 'group' && (
              <p className="text-xs text-muted-foreground">Group Chat</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearchBar(!showSearchBar)}
            title="Search messages"
          >
            {showSearchBar ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="More options">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowGroupDialog(true)}>
                <Users className="mr-2 h-4 w-4" />
                New Group Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPollCreator(true)}>
                Create Poll
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowScheduleDialog(true)}>
                Schedule Message
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
                <Download className="mr-2 h-4 w-4" />
                Export Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSettings(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search Bar */}
      {showSearchBar && (
        <>
          <SearchBar
            chatId={chatId}
            onSearchResults={handleSearchResults}
            onNavigateResult={handleNavigateSearchResult}
          />
          {searchResults.length > 0 && (
            <SearchResults
              results={searchResults}
              currentIndex={currentSearchIndex}
              onResultClick={handleSearchResultClick}
            />
          )}
        </>
      )}

      {/* Pinned Message Banner */}
      {pinnedMessages.length > 0 && (
        <PinnedMessageBanner
          chatId={chatId}
          pinnedMessages={pinnedMessages}
          messages={messages}
          onNavigateToMessage={handleNavigateToMessage}
          onUnpin={handlePinMessage}
        />
      )}

      {hasMoreMessages && messages.length > 0 && (
        <div className="flex items-center justify-center py-3 border-b border-border/40">
          <div ref={sentinelRef} className="h-1" />
          {isLoadingMore ? (
            <div className="text-xs text-muted-foreground">
              Loading older messages...
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={loadOlderMessages}
              disabled={isLoadingMore}
              className="gap-2"
            >
              <ChevronUp className="w-4 h-4" />
              Load older messages
            </Button>
          )}
        </div>
      )}

      <div data-message-container className="flex-1 overflow-hidden">
        <MessageList
          chatId={chatId}
          messages={messages}
          currentUserId={currentUserId}
          reactions={reactions}
          readReceipts={readReceipts}
          pinnedMessages={pinnedMessages}
          replies={replies}
          onReactionsChange={reloadReactions}
          onLoadMore={loadOlderMessages}
          hasMore={hasMoreMessages}
          isLoading={isLoadingMore}
        />
      </div>

      {/* Message Input */}
      <MessageInput chatId={chatId} onSendMessage={handleSendMessage} disabled={!chatId} />

      {/* Dialogs */}
      <EditMessageDialog
        message={editingMessage}
        open={!!editingMessage}
        onOpenChange={(open) => !open && setEditingMessage(null)}
        onSave={handleEditMessage}
      />

      <ForwardDialog
        messageId={forwardingMessageId}
        open={!!forwardingMessageId}
        onOpenChange={(open) => !open && setForwardingMessageId(null)}
        chats={chats}
        currentChatId={chatId}
      />

      <ExportDialog
        chatId={chatId}
        chatName={currentChat?.title || 'Chat'}
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />

      <GroupChatDialog
        open={showGroupDialog}
        onOpenChange={setShowGroupDialog}
        currentUserId={currentUserId}
        availableUsers={['user1', 'user2', 'user3']} // TODO: Load from backend
        onGroupCreated={(groupId) => {
          toast.success('Group created', { duration: 2000 });
          setShowGroupDialog(false);
        }}
      />

      <PollCreator
        open={showPollCreator}
        onOpenChange={setShowPollCreator}
        chatId={chatId}
        onPollCreated={(messageId, pollId) => {
          setShowPollCreator(false);
          // Refresh messages to show the poll
        }}
      />

      <ScheduleMessageDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        chatId={chatId}
        currentUserId={currentUserId}
        onMessageScheduled={(scheduledId) => {
          setShowScheduleDialog(false);
        }}
      />

      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />

      <CommandPalette
        chats={chats}
        onChatSelect={handleCommandChatSelect}
        onAction={handleCommandAction}
      />
    </div>
  );
};

export default ChatView;
