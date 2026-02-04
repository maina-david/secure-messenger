import React, { useState } from 'react';
import { Plus, X, BarChart3, Calendar } from 'lucide-react';
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
import { toast } from 'sonner';

interface PollCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: number;
  onPollCreated?: (messageId: number, pollId: number) => void;
}

const PollCreator: React.FC<PollCreatorProps> = ({
  open,
  onOpenChange,
  chatId,
  onPollCreated,
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    } else {
      toast.error('Maximum 10 options allowed');
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    } else {
      toast.error('Minimum 2 options required');
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const validatePoll = (): string | null => {
    if (!question.trim()) {
      return 'Please enter a question';
    }

    const validOptions = options.filter((opt) => opt.trim());
    if (validOptions.length < 2) {
      return 'Please provide at least 2 valid options';
    }

    if (question.length > 200) {
      return 'Question is too long (max 200 characters)';
    }

    for (const opt of validOptions) {
      if (opt.length > 100) {
        return 'Option is too long (max 100 characters)';
      }
    }

    return null;
  };

  const handleCreate = async () => {
    const error = validatePoll();
    if (error) {
      toast.error(error);
      return;
    }

    setIsCreating(true);
    try {
      // First, create a message for the poll
      const messageResponse = await window.electronAPI.sendMessage(
        chatId,
        'system',
        `📊 Poll: ${question}`
      );

      if (!messageResponse.success || !messageResponse.data) {
        throw new Error(messageResponse.error || 'Failed to create poll message');
      }

      const messageId = messageResponse.data.id;

      // Calculate expiration timestamp if provided
      let expiresAt: number | undefined;
      if (expiresIn) {
        const hours = parseInt(expiresIn, 10);
        if (!isNaN(hours) && hours > 0) {
          expiresAt = Date.now() + hours * 60 * 60 * 1000;
        }
      }

      // Create the poll
      const validOptions = options.filter((opt) => opt.trim());
      const pollResponse = await window.electronAPI.createPoll({
        messageId,
        question: question.trim(),
        options: validOptions,
        allowMultiple,
        expiresAt,
      });

      if (pollResponse.success && pollResponse.data) {
        toast.success('Poll created successfully');
        onPollCreated?.(messageId, pollResponse.data);
        handleClose();
      } else {
        throw new Error(pollResponse.error || 'Failed to create poll');
      }
    } catch (error) {
      console.error('Create poll error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create poll');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setQuestion('');
    setOptions(['', '']);
    setAllowMultiple(false);
    setExpiresIn('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Create Poll
          </DialogTitle>
          <DialogDescription>
            Create an interactive poll for your chat participants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Question Input */}
          <div className="space-y-2">
            <Label htmlFor="question">Question *</Label>
            <Input
              id="question"
              type="text"
              placeholder="What's your question?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              {question.length}/200 characters
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label>Options * (2-10)</Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    maxLength={100}
                  />
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(index)}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addOption}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Option
              </Button>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-3 pt-2">
            {/* Allow Multiple Votes */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="allow-multiple"
                checked={allowMultiple}
                onCheckedChange={(checked) => setAllowMultiple(checked as boolean)}
              />
              <Label htmlFor="allow-multiple" className="text-sm cursor-pointer">
                Allow multiple votes
              </Label>
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label htmlFor="expires-in" className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Expires in (hours, optional)
              </Label>
              <Input
                id="expires-in"
                type="number"
                min="1"
                max="720"
                placeholder="e.g., 24"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for no expiration
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Poll'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PollCreator;
