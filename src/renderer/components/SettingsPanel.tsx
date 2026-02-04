import React, { useState, useEffect } from 'react';
import { Settings, Keyboard, Volume2, RotateCcw, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { KeyboardShortcut } from '../types';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_SOUNDS = [
  { id: 'default', name: 'Default' },
  { id: 'bell', name: 'Bell' },
  { id: 'chime', name: 'Chime' },
  { id: 'ding', name: 'Ding' },
  { id: 'pop', name: 'Pop' },
  { id: 'none', name: 'Silent' },
];

const SettingsPanel: React.FC<SettingsPanelProps> = ({ open, onOpenChange }) => {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [defaultSound, setDefaultSound] = useState<string>('default');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings when dialog opens
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Load keyboard shortcuts
      const shortcutsResponse = await window.electronAPI.getKeyboardShortcuts();
      if (shortcutsResponse.success && shortcutsResponse.data) {
        setShortcuts(shortcutsResponse.data);
      }

      // Load default notification sound
      const soundResponse = await window.electronAPI.getNotificationSound();
      if (soundResponse.success && soundResponse.data) {
        setDefaultSound(soundResponse.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save keyboard shortcuts
      const shortcutsResponse = await window.electronAPI.setKeyboardShortcuts(shortcuts);
      if (!shortcutsResponse.success) {
        throw new Error('Failed to save keyboard shortcuts');
      }

      // Save notification sound
      const soundResponse = await window.electronAPI.setNotificationSound(
        null,
        defaultSound
      );
      if (!soundResponse.success) {
        throw new Error('Failed to save notification sound');
      }

      toast.success('Settings saved successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetShortcuts = async () => {
    try {
      const response = await window.electronAPI.resetKeyboardShortcuts();
      if (response.success && response.data) {
        setShortcuts(response.data);
        toast.success('Keyboard shortcuts reset to defaults');
      } else {
        throw new Error('Failed to reset shortcuts');
      }
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Failed to reset shortcuts');
    }
  };

  const handleTestSound = async () => {
    toast('Test notification', {
      description: 'This is how your notification will sound',
    });
  };

  const formatShortcut = (shortcut: KeyboardShortcut): string => {
    const parts = [...shortcut.modifiers, shortcut.key];
    return parts.join('+');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-150 max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Customize your messaging experience
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-125 px-6">
          <div className="space-y-6 pb-4">
            {/* Notification Sounds Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Notification Sounds</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="default-sound">Default Notification Sound</Label>
                  <div className="flex gap-2">
                    <Select value={defaultSound} onValueChange={setDefaultSound}>
                      <SelectTrigger id="default-sound" className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_SOUNDS.map((sound) => (
                          <SelectItem key={sound.id} value={sound.id}>
                            {sound.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleTestSound}>
                      Test
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This sound will play for all new messages by default
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Keyboard Shortcuts Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetShortcuts}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to Defaults
                </Button>
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Loading shortcuts...
                </div>
              ) : shortcuts.length > 0 ? (
                <div className="space-y-2">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.action}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {shortcut.description}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {shortcut.action}
                        </div>
                      </div>
                      <kbd className="px-3 py-1.5 text-xs font-semibold text-foreground bg-muted border border-border rounded">
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No keyboard shortcuts configured
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Note: Keyboard shortcut editing is coming soon. You can reset to defaults
                for now.
              </p>
            </div>

            <Separator />

            {/* Additional Settings Placeholder */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">More Settings</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>• Theme customization (coming soon)</p>
                <p>• Privacy settings (coming soon)</p>
                <p>• Auto-download media (coming soon)</p>
                <p>• Language preferences (coming soon)</p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsPanel;
