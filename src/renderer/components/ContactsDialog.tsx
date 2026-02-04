import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Loader2, MessageSquare, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Contact } from '../types';
import { cn } from '@/lib/utils';

interface ContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactSelect: (chatId: number) => void;
}

const ContactsDialog: React.FC<ContactsDialogProps> = ({
  open,
  onOpenChange,
  onContactSelect,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState<string | null>(null);

  // Load contacts when dialog opens
  useEffect(() => {
    if (open) {
      loadContacts();
      setSearchQuery('');
    }
  }, [open]);

  // Search contacts when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchContacts(searchQuery);
    } else {
      loadContacts();
    }
  }, [searchQuery]);

  const loadContacts = async () => {
    setIsLoading(true);
    try {
      const response = await window.electronAPI.getContacts(100, 0);
      if (response.success && response.data) {
        setContacts(response.data);
      } else {
        toast.error('Failed to load contacts');
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  };

  const searchContacts = async (query: string) => {
    setIsLoading(true);
    try {
      const response = await window.electronAPI.searchContacts(query);
      if (response.success && response.data) {
        setContacts(response.data);
      } else {
        toast.error('Failed to search contacts');
      }
    } catch (error) {
      console.error('Error searching contacts:', error);
      toast.error('Failed to search contacts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactClick = async (contact: Contact) => {
    setIsCreatingChat(contact.userId);
    try {
      const response = await window.electronAPI.createChatWithContact(contact.userId);
      if (response.success && response.data) {
        toast.success(`Chat created with ${contact.name}`);
        onContactSelect(response.data);
        onOpenChange(false);
      } else {
        toast.error(response.error || 'Failed to create chat');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('Failed to create chat');
    } finally {
      setIsCreatingChat(null);
    }
  };

  const formatLastSeen = (lastSeen?: number | null): string => {
    if (!lastSeen) return 'Never';

    const now = Date.now();
    const diff = now - lastSeen;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(lastSeen).toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-150 max-h-[85vh] p-0 shadow-2xl border-4 border-primary bg-white dark:bg-gray-900 ring-4 ring-primary/10 text-gray-900 dark:text-gray-100">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-gray-100">
            <UserPlus className="h-6 w-6 text-primary" />
            New Chat
          </DialogTitle>
          <DialogDescription className="text-base text-gray-600 dark:text-gray-400">
            Select a contact to start a new conversation
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 pb-4 bg-white dark:bg-gray-900">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
            <Input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
            />
          </div>
        </div>

        {/* Contacts List */}
        <ScrollArea className="h-100 px-6 pb-6 bg-white dark:bg-gray-900">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500 dark:text-gray-400" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserPlus className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {searchQuery ? 'No contacts found' : 'No contacts available'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleContactClick(contact)}
                  disabled={isCreatingChat === contact.userId}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
                    'hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 focus:outline-none',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-primary">
                      {contact.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">
                      {contact.name}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      {contact.status && (
                        <span className="truncate max-w-37.5">{contact.status}</span>
                      )}
                      {contact.status && <span>•</span>}
                      <span>{formatLastSeen(contact.lastSeen)}</span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="shrink-0">
                    {isCreatingChat === contact.userId ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-500 dark:text-gray-400" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ContactsDialog;
