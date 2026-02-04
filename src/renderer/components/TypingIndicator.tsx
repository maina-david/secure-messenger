import React from 'react';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  userName?: string;
  className?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ userName, className }) => {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2 animate-in fade-in duration-200', className)}>
      {/* Avatar */}
      <div className="shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-semibold text-primary shadow-sm">
          {userName?.charAt(0).toUpperCase() || '?'}
        </div>
      </div>

      {/* Typing bubble */}
      <div className="max-w-[70%]">
        <div className="text-xs text-muted-foreground/80 mb-1.5 font-medium">
          {userName || 'Someone'} is typing...
        </div>
        <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-accent/80 shadow-sm">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
            <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }} />
            <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1s' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
