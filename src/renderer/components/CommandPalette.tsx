import React, { useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Search, MessageSquare, Users, Download, Settings, Calendar, BarChart3 } from 'lucide-react';
import { Chat } from '../types';

interface CommandPaletteProps {
  chats: Chat[];
  onChatSelect: (chatId: number) => void;
  onAction: (action: string) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  chats,
  onChatSelect,
  onAction,
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelectChat = (chatId: number) => {
    onChatSelect(chatId);
    setOpen(false);
  };

  const handleAction = (action: string) => {
    onAction(action);
    setOpen(false);
  };

  // Get recent chats (first 10)
  const recentChats = chats.slice(0, 10);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recent Chats */}
        {recentChats.length > 0 && (
          <>
            <CommandGroup heading="Recent Chats">
              {recentChats.map((chat) => (
                <CommandItem
                  key={chat.id}
                  value={`chat-${chat.id}-${chat.title}`}
                  onSelect={() => handleSelectChat(chat.id)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span>{chat.title}</span>
                  {chat.unreadCount > 0 && (
                    <span className="ml-auto text-xs text-primary">
                      {chat.unreadCount} unread
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => handleAction('new-group')}>
            <Users className="mr-2 h-4 w-4" />
            <span>New Group Chat</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction('search')}>
            <Search className="mr-2 h-4 w-4" />
            <span>Search Messages</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction('export')}>
            <Download className="mr-2 h-4 w-4" />
            <span>Export Chat</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction('poll')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Create Poll</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction('schedule')}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Schedule Message</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction('settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        {/* All Chats */}
        {chats.length > 10 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="All Chats">
              {chats.slice(10).map((chat) => (
                <CommandItem
                  key={chat.id}
                  value={`all-chat-${chat.id}-${chat.title}`}
                  onSelect={() => handleSelectChat(chat.id)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span>{chat.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
