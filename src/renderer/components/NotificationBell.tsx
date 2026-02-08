import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { selectChat } from '../store/messagesSlice';
import { markChatAsRead } from '../store/chatsSlice';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UnreadChat {
  id: number;
  title: string;
  unreadCount: number;
  lastMessageAt: number;
}

const NotificationBell: React.FC = () => {
  const dispatch = useAppDispatch();
  const chats = useAppSelector((state) => state.chats.chats);
  const [isOpen, setIsOpen] = useState(false);

  // Get chats with unread messages
  const unreadChats: UnreadChat[] = chats
    .filter(chat => chat.unreadCount > 0)
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
    .slice(0, 10); // Show max 10 recent unread chats

  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  const handleChatClick = async (chatId: number) => {
    // Mark as read
    const response = await window.electronAPI.markChatRead(chatId);
    if (response.success) {
      dispatch(markChatAsRead(chatId));
    }

    // Select the chat
    dispatch(selectChat(chatId));

    // Close dropdown
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative transition-all duration-200 rounded-lg h-9 w-9 hover:scale-105"
          title="Notifications"
        >
          <Bell className="w-4 h-4 text-foreground" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="overflow-y-auto w-80 max-h-96">
        {unreadChats.length === 0 ? (
          <div className="py-8 text-sm text-center text-muted-foreground">
            No unread messages
          </div>
        ) : (
          <>
            <div className="px-3 py-2 text-xs font-semibold border-b text-muted-foreground">
              {totalUnread} unread message{totalUnread !== 1 ? 's' : ''}
            </div>
            {unreadChats.map((chat) => (
              <DropdownMenuItem
                key={chat.id}
                onClick={() => handleChatClick(chat.id)}
                className="px-3 py-3 cursor-pointer focus:bg-accent"
              >
                <div className="flex flex-col flex-1 min-w-0 gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {chat.title}
                    </span>
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true })}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
