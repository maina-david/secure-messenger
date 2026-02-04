import React from 'react';
import { useAppSelector } from '../store/hooks';
import { Wifi, WifiOff, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ConnectionStatus: React.FC = () => {
  const { status, lastPingTime } = useAppSelector((state) => state.websocket);

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          text: 'Connected',
          dotColor: 'bg-emerald-500',
          bgColor: 'bg-emerald-500/10',
          textColor: 'text-emerald-600',
        };
      case 'connecting':
        return {
          icon: LoaderCircle,
          text: 'Connecting',
          dotColor: 'bg-amber-500',
          bgColor: 'bg-amber-500/10',
          textColor: 'text-amber-600',
          animate: true,
        };
      case 'reconnecting':
        return {
          icon: LoaderCircle,
          text: 'Reconnecting',
          dotColor: 'bg-orange-500',
          bgColor: 'bg-orange-500/10',
          textColor: 'text-orange-600',
          animate: true,
        };
      case 'offline':
        return {
          icon: WifiOff,
          text: 'Offline',
          dotColor: 'bg-red-500',
          bgColor: 'bg-red-500/10',
          textColor: 'text-red-600',
        };
      default:
        return {
          icon: WifiOff,
          text: 'Unknown',
          dotColor: 'bg-gray-500',
          bgColor: 'bg-gray-500/10',
          textColor: 'text-gray-600',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between border-b border-border/50 bg-card/50 px-5 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <div className={cn(
          "flex items-center gap-2 rounded-full px-2.5 py-1 transition-all duration-300",
          config.bgColor
        )}>
          <Icon className={cn(
            "h-3.5 w-3.5 transition-colors duration-300",
            config.textColor,
            config.animate && "animate-spin"
          )} />
          <div className={cn(
            "h-1.5 w-1.5 rounded-full transition-all duration-300",
            config.dotColor,
            config.animate && "animate-pulse"
          )} />
          <span className={cn(
            "text-xs font-medium transition-colors duration-300",
            config.textColor
          )}>
            {config.text}
          </span>
        </div>
      </div>

      {lastPingTime && status === 'connected' && (
        <span className="text-xs text-muted-foreground">
          {new Date(lastPingTime).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </span>
      )}
    </div>
  );
};

export default ConnectionStatus;
