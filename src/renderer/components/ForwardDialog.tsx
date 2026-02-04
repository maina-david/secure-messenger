import React, { useState, useMemo } from 'react';
import { Search, Check, Users, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Chat } from '../types';

interface ForwardDialogProps {
  messageId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chats: Chat[];
  currentChatId: number;
}

const ForwardDialog: React.FC<ForwardDialogProps> = ({
  messageId,
  open,
  onOpenChange,
  chats,
  currentChatId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatIds, setSelectedChatIds] = useState<Set<number>>(new Set());
  const [isForwarding, setIsForwarding] = useState(false);

  // Filter out current chat and apply search
  const filteredChats = useMemo(() => {
    return chats
      .filter((chat) => chat.id !== currentChatId)
      .filter((chat) =>
        searchQuery
          ? chat.title.toLowerCase().includes(searchQuery.toLowerCase())
          : true
      );
  }, [chats, currentChatId, searchQuery]);

  // Separate into groups and direct chats
  const groupChats = filteredChats.filter((chat) => chat.type === 'group');
  const directChats = filteredChats.filter((chat) => chat.type !== 'group');

  const toggleChatSelection = (chatId: number) => {
    setSelectedChatIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  };

  const handleForward = async () => {
    if (!messageId || selectedChatIds.size === 0) return;

    setIsForwarding(true);
    try {
      const targetChatIds = Array.from(selectedChatIds);

      // Forward to each chat individually (API accepts one chat at a time)
      const promises = targetChatIds.map((chatId) =>
        window.electronAPI.forwardMessage(messageId, chatId, 'currentUser')
      );

      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.success).length;

      if (successCount > 0) {
        toast.success(
          `Message forwarded to ${successCount} chat${successCount > 1 ? 's' : ''}`
        );
        setSelectedChatIds(new Set());
        setSearchQuery('');
        onOpenChange(false);
      } else {
        toast.error('Failed to forward message');
      }
    } catch (error) {
      toast.error('Unexpected error occurred');
      console.error('Forward error:', error);
    } finally {
      setIsForwarding(false);
    }
  };

  const handleClose = () => {
    setSelectedChatIds(new Set());
    setSearchQuery('');
    onOpenChange(false);
  };

  const renderChatItem = (chat: Chat) => {
    const isSelected = selectedChatIds.has(chat.id);
    const isGroup = chat.type === 'group';

    return (
      <button
        key={chat.id}
        onClick={() => toggleChatSelection(chat.id)}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
          'hover:bg-accent',
          isSelected && 'bg-accent'
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
            isGroup ? 'bg-primary/10' : 'bg-secondary'
          )}
        >
          {isGroup ? (
            <Users className="h-5 w-5 text-primary" />
          ) : (
            <User className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* Chat Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="font-medium text-sm truncate">{chat.title}</div>
          {isGroup && (
            <div className="text-xs text-muted-foreground">Group Chat</div>
          )}
        </div>

        {/* Checkbox */}
        <div className="shrink-0">
          <Checkbox checked={isSelected} />
        </div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-125 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Forward Message</DialogTitle>
          <DialogDescription>
            Select one or more chats to forward this message to.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="h-100 px-6">
          <div className="space-y-4">
            {/* Group Chats Section */}
            {groupChats.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Group Chats
                </h3>
                <div className="space-y-1">
                  {groupChats.map((chat) => renderChatItem(chat))}
                </div>
              </div>
            )}

            {/* Direct Chats Section */}
            {directChats.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Direct Messages
                </h3>
                <div className="space-y-1">
                  {directChats.map((chat) => renderChatItem(chat))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredChats.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {searchQuery ? 'No chats found' : 'No other chats available'}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {selectedChatIds.size > 0 && (
                <span>
                  {selectedChatIds.size} chat{selectedChatIds.size > 1 ? 's' : ''} selected
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isForwarding}>
                Cancel
              </Button>
              <Button
                onClick={handleForward}
                disabled={selectedChatIds.size === 0 || isForwarding}
              >
                {isForwarding ? 'Forwarding...' : 'Forward'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ForwardDialog;
