import React from 'react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';

interface MessageTimeSeparatorProps {
  timestamp: number;
}

const MessageTimeSeparator: React.FC<MessageTimeSeparatorProps> = ({ timestamp }) => {
  const date = new Date(timestamp);

  const getFormattedDate = () => {
    if (isToday(date)) {
      return 'Today';
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else if (isThisWeek(date)) {
      return format(date, 'EEEE'); // Day name
    } else {
      return format(date, 'MMMM d, yyyy');
    }
  };

  return (
    <div className="flex items-center justify-center py-4 sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
      <div className="px-3 py-1 rounded-full bg-accent/60 text-xs font-medium text-muted-foreground shadow-sm">
        {getFormattedDate()}
      </div>
    </div>
  );
};

export default MessageTimeSeparator;
