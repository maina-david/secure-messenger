import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setDraft, clearDraft, loadDraft } from '../store/draftsSlice';
import { Message } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Smile, X, Reply } from 'lucide-react';
import { toast } from 'sonner';
import ReactionPicker from './ReactionPicker';
import FileUploader from './FileUploader';

interface MessageInputProps {
  chatId: number | null;
  onSendMessage: (message: string, replyToMessageId?: number) => void;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ chatId, onSendMessage, disabled = false }) => {
  const dispatch = useAppDispatch();
  const savedDraft = useAppSelector((state) =>
    chatId ? state.drafts.draftsByChatId[chatId] : undefined
  );
  const [message, setMessage] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFileUploader, setShowFileUploader] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chatId) {
      if (savedDraft) {
        setMessage(savedDraft);
      } else {
        window.electronAPI.getDraft(chatId).then((response) => {
          if (response.success && response.data) {
            setMessage(response.data);
            dispatch(loadDraft({ chatId, content: response.data }));
          } else {
            setMessage('');
          }
        });
      }
    } else {
      setMessage('');
    }
  }, [chatId, savedDraft, dispatch]);

  useEffect(() => {
    const handleReplyEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Message>;
      setReplyToMessage(customEvent.detail);
      textareaRef.current?.focus();
    };

    window.addEventListener('reply-to-message', handleReplyEvent);
    return () => {
      window.removeEventListener('reply-to-message', handleReplyEvent);
    };
  }, []);

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  const saveDraftDebounced = useCallback((content: string) => {
    if (!chatId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    dispatch(setDraft({ chatId, content }));

    saveTimeoutRef.current = setTimeout(() => {
      if (content.trim()) {
        window.electronAPI.saveDraft(chatId, content);
      } else {
        window.electronAPI.deleteDraft(chatId);
      }
    }, 500);
  }, [chatId, dispatch]);

  const handleMessageChange = (value: string) => {
    setMessage(value);
    saveDraftDebounced(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && chatId) {
      onSendMessage(message.trim(), replyToMessage?.id);
      setMessage('');
      setReplyToMessage(null); // Clear reply after sending

      // Clear draft from Redux and database
      dispatch(clearDraft(chatId));
      window.electronAPI.deleteDraft(chatId);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    // Insert emoji at cursor position
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMessage = message.substring(0, start) + emoji + message.substring(end);

    setMessage(newMessage);
    saveDraftDebounced(newMessage);
    setShowEmojiPicker(false);

    // Restore cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleFileUpload = async (attachment: {
    filePath: string;
    fileName: string;
    fileSize: number;
    type: 'image' | 'file' | 'voice' | 'video';
    mimeType: string;
  }) => {
    if (!chatId) return;

    toast.success(`File uploaded: ${attachment.fileName}`);
    setShowFileUploader(false);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border/50 bg-card backdrop-blur-custom">
      {/* Reply Preview */}
      {replyToMessage && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent/50 border-b border-border/50">
          <Reply className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground">
              Replying to {replyToMessage.sender}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {replyToMessage.body}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCancelReply}
            className="h-6 w-6 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="p-4">
        {/* File Uploader */}
        {showFileUploader && (
          <div className="mb-3">
            <FileUploader
              onUploadComplete={(attachment) => {
                handleFileUpload(attachment);
              }}
            />
          </div>
        )}

        <div className="flex items-end gap-3">
        {/* Attachment button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={() => setShowFileUploader(!showFileUploader)}
          className="h-11 w-11 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        {/* Message input */}
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={disabled ? "Select a chat to send messages" : "Type a message..."}
            disabled={disabled}
            rows={1}
            className="min-h-11 max-h-32 resize-none rounded-2xl border-border/50 bg-background px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
          />
          {/* Emoji button */}
          <ReactionPicker
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="absolute bottom-1.5 right-1.5 h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Smile className="h-4 w-4" />
              </Button>
            }
            onSelect={handleEmojiSelect}
            open={showEmojiPicker}
            onOpenChange={setShowEmojiPicker}
          />
        </div>

        {/* Send button */}
        <Button
          type="submit"
          size="icon"
          disabled={disabled || !message.trim()}
          className="h-11 w-11 shrink-0 rounded-full bg-primary shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl disabled:scale-100 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
        <div className="ml-14 mt-1.5 text-[11px] text-muted-foreground">
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">Enter</kbd> to send • <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">Shift+Enter</kbd> for new line
        </div>
      </div>
    </form>
  );
};

export default MessageInput;
