import React, { useState } from 'react';
import { Users, X, Search, UserPlus } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GroupChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  availableUsers: string[]; // List of user IDs
  onGroupCreated?: (groupId: number) => void;
}

const GroupChatDialog: React.FC<GroupChatDialogProps> = ({
  open,
  onOpenChange,
  currentUserId,
  availableUsers,
  onGroupCreated,
}) => {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  // Filter users based on search and exclude current user
  const filteredUsers = availableUsers
    .filter((user) => user !== currentUserId)
    .filter((user) =>
      searchQuery ? user.toLowerCase().includes(searchQuery.toLowerCase()) : true
    );

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    if (selectedUsers.size === 0) {
      toast.error('Please select at least one user');
      return;
    }

    setIsCreating(true);
    try {
      // Include current user in the participants
      const participantIds = Array.from(selectedUsers);

      const response = await window.electronAPI.createGroupChat(
        groupName.trim(),
        currentUserId,
        participantIds
      );

      if (response.success && response.data) {
        toast.success(`Group "${groupName}" created successfully`);
        onGroupCreated?.(response.data);
        handleClose();
      } else {
        toast.error(response.error || 'Failed to create group');
      }
    } catch (error) {
      toast.error('Unexpected error occurred');
      console.error('Create group error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSearchQuery('');
    setSelectedUsers(new Set());
    onOpenChange(false);
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create Group Chat
          </DialogTitle>
          <DialogDescription>
            Create a new group chat and invite participants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Group Name Input */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name *</Label>
            <Input
              id="group-name"
              type="text"
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              {groupName.length}/50 characters
            </p>
          </div>

          {/* Selected Users */}
          {selectedUsers.size > 0 && (
            <div className="space-y-2">
              <Label>Selected Participants ({selectedUsers.size})</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-accent/50 rounded-lg min-h-[60px]">
                {Array.from(selectedUsers).map((userId) => (
                  <Badge
                    key={userId}
                    variant="secondary"
                    className="px-3 py-1.5 gap-2"
                  >
                    {userId}
                    <button
                      onClick={() => removeUser(userId)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* User Search */}
          <div className="space-y-2">
            <Label>Add Participants</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* User List */}
          <ScrollArea className="h-[250px] border rounded-lg">
            <div className="p-2">
              {filteredUsers.length > 0 ? (
                <div className="space-y-1">
                  {filteredUsers.map((userId) => {
                    const isSelected = selectedUsers.has(userId);
                    return (
                      <button
                        key={userId}
                        onClick={() => toggleUserSelection(userId)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
                          'hover:bg-accent',
                          isSelected && 'bg-accent'
                        )}
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <UserPlus className="h-5 w-5 text-primary" />
                        </div>

                        {/* User Info */}
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-medium text-sm truncate">
                            {userId}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            User
                          </div>
                        </div>

                        {/* Checkbox */}
                        <div className="shrink-0">
                          <Checkbox checked={isSelected} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  {searchQuery ? 'No users found' : 'No users available'}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedUsers.size === 0 || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GroupChatDialog;
