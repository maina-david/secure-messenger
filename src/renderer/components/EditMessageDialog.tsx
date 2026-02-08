import React, { useState, useEffect } from 'react';
import { Message } from '../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface EditMessageDialogProps {
  message: Message | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (messageId: number, newBody: string) => Promise<void>;
}

const EditMessageDialog: React.FC<EditMessageDialogProps> = ({
  message,
  open,
  onOpenChange,
  onSave,
}) => {
  const [editedBody, setEditedBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (message) {
      setEditedBody(message.body);
    }
  }, [message]);

  const handleSave = async () => {
    if (!message) return;

    if (editedBody.trim() === '') {
      toast.error('Message cannot be empty');
      return;
    }

    if (editedBody === message.body) {
      toast.info('No changes made');
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(message.id, editedBody.trim());
      toast.success('Message updated');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to update message');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-131.25">
        <DialogHeader>
          <DialogTitle>Edit Message</DialogTitle>
          <DialogDescription>
            Make changes to your message. Press Ctrl+Enter to save.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Edit your message..."
            className="min-h-30"
            autoFocus
          />
          <div className="text-xs text-muted-foreground">
            <kbd className="rounded bg-muted px-1.5 py-0.5">Ctrl+Enter</kbd> to
            save • <kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd> to
            cancel
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditMessageDialog;
