import React, { useState } from 'react';
import { Clock, Calendar, Send } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ScheduleMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: number;
  currentUserId: string;
  onMessageScheduled?: (scheduledId: number) => void;
}

const ScheduleMessageDialog: React.FC<ScheduleMessageDialogProps> = ({
  open,
  onOpenChange,
  chatId,
  currentUserId,
  onMessageScheduled,
}) => {
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  // Get current date and time for min attributes
  const now = new Date();
  const minDate = now.toISOString().split('T')[0];
  const minTime = now.toTimeString().slice(0, 5);

  const validateSchedule = (): string | null => {
    if (!message.trim()) {
      return 'Please enter a message';
    }

    if (!date) {
      return 'Please select a date';
    }

    if (!time) {
      return 'Please select a time';
    }

    // Combine date and time and validate it's in the future
    const scheduledDateTime = new Date(`${date}T${time}`);
    if (scheduledDateTime <= now) {
      return 'Scheduled time must be in the future';
    }

    // Check if it's within reasonable limits (e.g., not more than 1 year ahead)
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    if (scheduledDateTime > oneYearFromNow) {
      return 'Cannot schedule more than 1 year in advance';
    }

    return null;
  };

  const getPreviewText = (): string => {
    if (!date || !time) return '';

    const scheduledDateTime = new Date(`${date}T${time}`);
    const diffMs = scheduledDateTime.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `Will be sent in ${diffDays} day${diffDays > 1 ? 's' : ''} and ${
        diffHours % 24
      } hour${diffHours % 24 !== 1 ? 's' : ''}`;
    }
    if (diffHours > 0) {
      return `Will be sent in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    }
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `Will be sent in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
  };

  const handleSchedule = async () => {
    const error = validateSchedule();
    if (error) {
      toast.error(error);
      return;
    }

    setIsScheduling(true);
    try {
      const scheduledFor = new Date(`${date}T${time}`).getTime();

      const response = await window.electronAPI.scheduleMessage(
        chatId,
        currentUserId,
        message.trim(),
        scheduledFor
      );

      if (response.success && response.data) {
        toast.success('Message scheduled successfully');
        onMessageScheduled?.(response.data);
        handleClose();
      } else {
        throw new Error(response.error || 'Failed to schedule message');
      }
    } catch (error) {
      console.error('Schedule error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to schedule message');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleClose = () => {
    setMessage('');
    setDate('');
    setTime('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Schedule Message
          </DialogTitle>
          <DialogDescription>
            Schedule a message to be sent at a specific date and time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/1000 characters
            </p>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date *
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={minDate}
            />
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label htmlFor="time" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time *
            </Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              min={date === minDate ? minTime : undefined}
            />
          </div>

          {/* Preview */}
          {date && time && (
            <div className="bg-accent/50 border border-border rounded-lg p-3">
              <div className="text-sm">
                <span className="font-medium">Scheduled for:</span>{' '}
                {new Date(`${date}T${time}`).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {getPreviewText()}
              </div>
            </div>
          )}

          {/* Timezone Info */}
          <div className="text-xs text-muted-foreground">
            <strong>Note:</strong> Time is in your local timezone (
            {Intl.DateTimeFormat().resolvedOptions().timeZone})
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isScheduling}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={isScheduling} className="gap-2">
            <Send className="h-4 w-4" />
            {isScheduling ? 'Scheduling...' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleMessageDialog;
