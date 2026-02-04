import React, { useEffect, useState } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { store } from '../store';
import { websocketService } from '../services/websocketService';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { AuthProvider } from './AuthProvider';
import ConnectionStatus from './ConnectionStatus';
import ChatList from './ChatList';
import ChatView from './ChatView';
import { useAppSelector } from '../store/hooks';
import { logout } from '../store/authSlice';
import type { AppDispatch } from '../store';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Database, WifiOff, MessageSquare, Sun, Moon, LogOut, Settings } from 'lucide-react';
import SettingsPanel from './SettingsPanel';

const AppContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [stats, setStats] = useState<{ chats: number; messages: number } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const selectedChatId = useAppSelector((state) => state.messages.selectedChatId);
  const user = useAppSelector((state) => state.auth.user);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    websocketService.initialize();
    loadStats();

    return () => {
      websocketService.disconnect();
    };
  }, []);

  const loadStats = async () => {
    const response = await window.electronAPI.getStats();
    if (response.success && response.data) {
      setStats(response.data);
    }
  };

  const handleSeedDatabase = async () => {
    if (isSeeding) return;

    setIsSeeding(true);
    const toastId = toast.loading('Seeding database...');
    const response = await window.electronAPI.seedDatabase();
    if (response.success) {
      toast.success('Database seeded successfully!', { id: toastId });
      await loadStats();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      toast.error('Failed to seed database', { id: toastId });
    }
    setIsSeeding(false);
  };

  const handleSimulateDisconnect = async () => {
    await window.electronAPI.simulateDisconnect();
    toast.warning('WebSocket disconnected', {
      description: 'Connection will attempt to reconnect automatically',
    });
  };

  const handleChatSelect = (chatId: number) => {
  };

  const handleLogout = async () => {
    await dispatch(logout());
    toast.success('Logged out successfully');
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between bg-card px-6 py-3.5 backdrop-blur-custom">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/70 shadow-lg">
            <MessageSquare className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">Secure Messenger</h1>
              {user && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 rounded-full">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    {user.displayName || user.username}
                  </span>
                </div>
              )}
            </div>
            {stats && (
              <p className="text-[11px] text-muted-foreground">
                {stats.chats} chats • {stats.messages.toLocaleString()} messages
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2.5">
          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg transition-all duration-200 hover:scale-105"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-foreground" />
            ) : (
              <Moon className="h-4 w-4 text-foreground" />
            )}
          </Button>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg transition-all duration-200 hover:scale-105"
            title="Logout"
          >
            <LogOut className="h-4 w-4 text-foreground" />
          </Button>
          <Button
            onClick={() => setShowSettings(true)}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg transition-all duration-200 hover:scale-105"
            title="Settings"
          >
            <Settings className="h-4 w-4 text-foreground" />
          </Button>
          <Button
            onClick={handleSeedDatabase}
            disabled={isSeeding}
            variant="secondary"
            size="sm"
            className="h-9 gap-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105"
          >
            <Database className="h-3.5 w-3.5" />
            {isSeeding ? 'Seeding...' : stats !== null && stats.chats > 0 ? 'Reseed Database' : 'Seed Database'}
          </Button>
          <Button
            onClick={handleSimulateDisconnect}
            size="sm"
            className="h-9 gap-2 rounded-lg bg-red-600 text-white text-xs font-medium transition-all duration-200 hover:bg-red-700 hover:scale-105"
          >
            <WifiOff className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        </div>
      </header>

      <ConnectionStatus />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-87.5 bg-card">
          <ChatList onChatSelect={handleChatSelect} />
        </div>

        <div className="flex-1">
          <ChatView chatId={selectedChatId} currentUserId="Me" />
        </div>
      </div>

      {/* <SettingsPanel open={showSettings} onOpenChange={setShowSettings} /> */}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
          <Toaster position="top-center" expand={false} richColors />
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
};

export default App;
