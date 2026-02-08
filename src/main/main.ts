import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseService } from './database';
import { MessengerWebSocketServer } from './websocketServer';
import { securityService } from './security';
import { FileStorageService } from './fileStorageService';
import { SchedulerService } from './schedulerService';
import { TranslationService } from './translationService';
import { rateLimitService } from './services/RateLimitService';
import { createServices, Services } from './services';

let mainWindow: BrowserWindow | null = null;
let db: DatabaseService;
let services: Services;
let wsServer: MessengerWebSocketServer;
let fileStorage: FileStorageService;
let scheduler: SchedulerService;
let translationService: TranslationService;

const WS_PORT = 8080;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeServices() {
  await securityService.initialize();

  db = new DatabaseService();
  services = createServices(); // Initialize service layer
  wsServer = new MessengerWebSocketServer(WS_PORT, services);
  wsServer.start();
  fileStorage = new FileStorageService();
  scheduler = new SchedulerService(services, wsServer);
  scheduler.start();
  translationService = new TranslationService(db, 'mock');

  rateLimitService.startCleanupInterval();

  console.log('Services initialized');
}

app.whenReady().then(() => {
  initializeServices();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    scheduler.stop();
    wsServer.close();
    db.close();
    securityService.clearMasterKey(); // Clear keys from memory on quit
    app.quit();
  }
});

app.on('before-quit', () => {
  scheduler.stop();
  wsServer.close();
  db.close();
  securityService.clearMasterKey(); // Clear keys from memory before quit
});

ipcMain.handle('get-chats', async (event, limit: number, offset: number) => {
  try {
    const chats = services.chats.getChatList(limit, offset);
    return { success: true, data: chats };
  } catch (error) {
    console.error('Error getting chats:', error);
    return { success: false, error: 'Failed to get chats' };
  }
});

ipcMain.handle('get-messages', async (event, chatId: number, limit: number = 50, offset: number = 0) => {
  try {
    const messages = await services.messages.getMessages(chatId, limit, offset);
    return { success: true, data: messages };
  } catch (error) {
    console.error('Error getting messages:', error);
    return { success: false, error: 'Failed to get messages' };
  }
});

ipcMain.handle('get-messages-before', async (event, chatId: number, timestamp: number, limit: number = 50) => {
  try {
    const messages = await services.messages.getMessagesBefore(chatId, timestamp, limit);
    return { success: true, data: messages };
  } catch (error) {
    console.error('Error getting messages before timestamp:', error);
    return { success: false, error: 'Failed to get messages' };
  }
});

ipcMain.handle('get-messages-after', async (event, chatId: number, timestamp: number, limit: number = 100) => {
  try {
    const messages = await services.messages.getMessagesAfter(chatId, timestamp, limit);
    return { success: true, data: messages };
  } catch (error) {
    console.error('Error getting messages after timestamp:', error);
    return { success: false, error: 'Failed to get messages' };
  }
});

ipcMain.handle('get-last-messages-batch', async (event, chatIds: number[]) => {
  try {
    const messagesMap = await services.messages.getLastMessagesBatch(chatIds);
    const result: Record<number, any> = {};
    messagesMap.forEach((message, chatId) => {
      result[chatId] = message;
    });
    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting last messages batch:', error);
    return { success: false, error: 'Failed to get last messages' };
  }
});

ipcMain.handle('search-messages', async (event, chatId: number, query: string, limit: number = 50) => {
  try {
    const messages = await services.messages.searchMessages(query, limit);
    return { success: true, data: messages };
  } catch (error) {
    console.error('Error searching messages:', error);
    return { success: false, error: 'Failed to search messages' };
  }
});

ipcMain.handle('mark-chat-read', async (event, chatId: number, userId: string) => {
  try {
    services.messages.markChatAsRead(chatId, userId);
    return { success: true };
  } catch (error) {
    console.error('Error marking chat as read:', error);
    return { success: false, error: 'Failed to mark chat as read' };
  }
});

ipcMain.handle('send-message', async (event, chatId: number, sender: string, body: string) => {
  try {
    const message = await services.messages.sendMessage({ chatId, sender, body });

    if (wsServer) {
      wsServer.broadcastNewMessage(message);
    }

    return { success: true, data: message };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: 'Failed to send message' };
  }
});

ipcMain.handle('edit-message', async (event, messageId: number, newBody: string) => {
  try {
    const success = await services.messages.editMessage(messageId, newBody);
    if (success && wsServer) {
      wsServer.broadcastMessageEdited({ id: messageId, body: newBody });
    }
    return success
      ? { success: true, data: { id: messageId, body: newBody } }
      : { success: false, error: 'Message not found or already deleted' };
  } catch (error) {
    console.error('Error editing message:', error);
    return { success: false, error: 'Failed to edit message' };
  }
});

ipcMain.handle('delete-message', async (event, messageId: number) => {
  try {
    const success = await services.messages.deleteMessage(messageId);
    if (success && wsServer) {
      wsServer.broadcastMessageDeleted(messageId);
    }
    return success
      ? { success: true }
      : { success: false, error: 'Message not found' };
  } catch (error) {
    console.error('Error deleting message:', error);
    return { success: false, error: 'Failed to delete message' };
  }
});

ipcMain.handle('add-reaction', async (event, messageId: number, chatId: number, userId: string, emoji: string) => {
  try {
    const success = services.messages.addReaction(messageId, chatId, userId, emoji);
    if (success && wsServer) {
      wsServer.broadcastReactionAdded(messageId, chatId, userId, emoji);
    }
    return success
      ? { success: true, data: { messageId, chatId, userId, emoji, createdAt: Date.now() } }
      : { success: false, error: 'Reaction already exists' };
  } catch (error) {
    console.error('Error adding reaction:', error);
    return { success: false, error: 'Failed to add reaction' };
  }
});

ipcMain.handle('remove-reaction', async (event, messageId: number, userId: string, emoji: string) => {
  try {
    const success = services.messages.removeReaction(messageId, userId, emoji);
    if (success && wsServer) {
      wsServer.broadcastReactionRemoved(messageId, userId, emoji);
    }
    return success
      ? { success: true }
      : { success: false, error: 'Reaction not found' };
  } catch (error) {
    console.error('Error removing reaction:', error);
    return { success: false, error: 'Failed to remove reaction' };
  }
});

ipcMain.handle('get-reactions', async (event, messageId: number) => {
  try {
    const reactions = services.messages.getReactions(messageId);
    return { success: true, data: reactions };
  } catch (error) {
    console.error('Error getting reactions:', error);
    return { success: false, error: 'Failed to get reactions' };
  }
});

ipcMain.handle('get-reactions-by-chat', async (event, chatId: number) => {
  try {
    const reactions = services.messages.getReactionsByChat(chatId);
    return { success: true, data: reactions };
  } catch (error) {
    console.error('Error getting reactions by chat:', error);
    return { success: false, error: 'Failed to get reactions' };
  }
});

ipcMain.handle('mark-message-read', async (event, messageId: number, userId: string) => {
  try {
    const success = services.messages.markAsRead(messageId, userId);
    if (success && wsServer) {
      wsServer.broadcastMessageRead(messageId, userId);
    }
    return success
      ? { success: true }
      : { success: false, error: 'Failed to mark message as read' };
  } catch (error) {
    console.error('Error marking message as read:', error);
    return { success: false, error: 'Failed to mark message as read' };
  }
});

ipcMain.handle('get-read-receipts', async (event, messageId: number) => {
  try {
    const receipts = services.messages.getReadReceipts(messageId);
    return { success: true, data: receipts };
  } catch (error) {
    console.error('Error getting read receipts:', error);
    return { success: false, error: 'Failed to get read receipts' };
  }
});

ipcMain.handle('get-read-receipts-by-chat', async (event, chatId: number) => {
  try {
    const receipts = services.messages.getReadReceiptsByChat(chatId);
    return { success: true, data: receipts };
  } catch (error) {
    console.error('Error getting read receipts by chat:', error);
    return { success: false, error: 'Failed to get read receipts' };
  }
});

ipcMain.handle('mark-message-delivered', async (event, messageId: number) => {
  try {
    services.messages.markMessageDelivered(messageId);
    if (wsServer) {
      wsServer.broadcastMessageDelivered(messageId);
    }
    return { success: true };
  } catch (error) {
    console.error('Error marking message as delivered:', error);
    return { success: false, error: 'Failed to mark message as delivered' };
  }
});

ipcMain.handle('get-delivery-status', async (event, messageId: number) => {
  try {
    const status = services.messages.getDeliveryStatus(messageId);
    return { success: true, data: status };
  } catch (error) {
    console.error('Error getting delivery status:', error);
    return { success: false, error: 'Failed to get delivery status' };
  }
});

ipcMain.handle('save-draft', async (event, chatId: number, content: string) => {
  try {
    services.chats.saveDraft(chatId, content);
    return { success: true };
  } catch (error) {
    console.error('Error saving draft:', error);
    return { success: false, error: 'Failed to save draft' };
  }
});

ipcMain.handle('get-draft', async (event, chatId: number) => {
  try {
    const draft = services.chats.getDraft(chatId);
    return { success: true, data: draft };
  } catch (error) {
    console.error('Error getting draft:', error);
    return { success: false, error: 'Failed to get draft' };
  }
});

ipcMain.handle('delete-draft', async (event, chatId: number) => {
  try {
    services.chats.deleteDraft(chatId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting draft:', error);
    return { success: false, error: 'Failed to delete draft' };
  }
});

ipcMain.handle('search-all-messages', async (event, query: string, limit: number) => {
  try {
    const messages = await services.messages.searchMessagesAllChats(query, limit);
    return { success: true, data: messages };
  } catch (error) {
    console.error('Error searching all messages:', error);
    return { success: false, error: 'Failed to search messages' };
  }
});

ipcMain.handle('set-message-reply', async (event, messageId: number, replyToMessageId: number) => {
  try {
    const success = services.messages.setMessageReply(messageId, replyToMessageId);
    return success
      ? { success: true }
      : { success: false, error: 'Failed to set message reply' };
  } catch (error) {
    console.error('Error setting message reply:', error);
    return { success: false, error: 'Failed to set message reply' };
  }
});

ipcMain.handle('get-message-reply', async (event, messageId: number) => {
  try {
    const replyToMessageId = services.messages.getMessageReply(messageId);
    return { success: true, data: replyToMessageId };
  } catch (error) {
    console.error('Error getting message reply:', error);
    return { success: false, error: 'Failed to get message reply' };
  }
});

ipcMain.handle('get-replies-to', async (event, messageId: number) => {
  try {
    const replies = await services.messages.getRepliesTo(messageId);
    return { success: true, data: replies };
  } catch (error) {
    console.error('Error getting replies:', error);
    return { success: false, error: 'Failed to get replies' };
  }
});

ipcMain.handle('delete-message-reply', async (event, messageId: number) => {
  try {
    const success = services.messages.deleteMessageReply(messageId);
    return success
      ? { success: true }
      : { success: false, error: 'Reply not found' };
  } catch (error) {
    console.error('Error deleting message reply:', error);
    return { success: false, error: 'Failed to delete message reply' };
  }
});

ipcMain.handle('pin-message', async (event, messageId: number, chatId: number, pinnedBy: string) => {
  try {
    const pinnedId = services.messages.pinMessage(messageId, chatId, pinnedBy);
    if (pinnedId && wsServer) {
      wsServer.broadcastMessagePinned(messageId, chatId);
    }
    return pinnedId
      ? { success: true, data: { id: pinnedId, messageId, chatId, pinnedBy, pinnedAt: Date.now() } }
      : { success: false, error: 'Message already pinned' };
  } catch (error) {
    console.error('Error pinning message:', error);
    return { success: false, error: 'Failed to pin message' };
  }
});

ipcMain.handle('unpin-message', async (event, messageId: number, chatId: number) => {
  try {
    const success = services.messages.unpinMessage(messageId, chatId);
    if (success && wsServer) {
      wsServer.broadcastMessageUnpinned(messageId, chatId);
    }
    return success
      ? { success: true }
      : { success: false, error: 'Pinned message not found' };
  } catch (error) {
    console.error('Error unpinning message:', error);
    return { success: false, error: 'Failed to unpin message' };
  }
});

ipcMain.handle('get-pinned-messages', async (event, chatId: number) => {
  try {
    const pinnedMessages = services.messages.getPinnedMessages(chatId);
    return { success: true, data: pinnedMessages };
  } catch (error) {
    console.error('Error getting pinned messages:', error);
    return { success: false, error: 'Failed to get pinned messages' };
  }
});

ipcMain.handle('is-pinned', async (event, messageId: number, chatId: number) => {
  try {
    const isPinned = services.messages.isPinned(messageId, chatId);
    return { success: true, data: isPinned };
  } catch (error) {
    console.error('Error checking if message is pinned:', error);
    return { success: false, error: 'Failed to check pinned status' };
  }
});

ipcMain.handle('export-messages', async (event, chatId: number, format: 'txt' | 'json' | 'html') => {
  try {
    const messages = await services.messages.getMessages(chatId, 10000, 0);
    const chat = services.chats.getChat(chatId);

    if (!chat) {
      return { success: false, error: 'Chat not found' };
    }

    let content = '';
    let defaultFilename = '';
    let filters: Electron.FileFilter[] = [];

    switch (format) {
      case 'txt':
        content = formatAsTxt(messages, chat.title);
        defaultFilename = `${chat.title}_export.txt`;
        filters = [{ name: 'Text Files', extensions: ['txt'] }];
        break;
      case 'json':
        content = formatAsJson(messages, chat);
        defaultFilename = `${chat.title}_export.json`;
        filters = [{ name: 'JSON Files', extensions: ['json'] }];
        break;
      case 'html':
        content = formatAsHtml(messages, chat.title);
        defaultFilename = `${chat.title}_export.html`;
        filters = [{ name: 'HTML Files', extensions: ['html'] }];
        break;
    }

    const result = await dialog.showSaveDialog({
      title: 'Export Messages',
      defaultPath: defaultFilename,
      filters,
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export cancelled' };
    }

    fs.writeFileSync(result.filePath, content, 'utf-8');

    return { success: true, data: result.filePath };
  } catch (error) {
    console.error('Error exporting messages:', error);
    return { success: false, error: 'Failed to export messages' };
  }
});

function formatAsTxt(messages: any[], chatTitle: string): string {
  let output = `Chat Export: ${chatTitle}\n`;
  output += `Exported: ${new Date().toLocaleString()}\n`;
  output += `Total Messages: ${messages.length}\n`;
  output += '='.repeat(80) + '\n\n';

  for (const msg of messages) {
    const date = new Date(msg.ts).toLocaleString();
    const status = msg.isDeleted ? ' [DELETED]' : (msg.editedAt ? ' [EDITED]' : '');
    output += `[${date}] ${msg.sender}${status}:\n`;
    output += `${msg.body}\n\n`;
  }

  return output;
}

function formatAsJson(messages: any[], chat: any): string {
  return JSON.stringify({
    chat: {
      id: chat.id,
      title: chat.title,
      exportedAt: new Date().toISOString(),
    },
    messages: messages.map(msg => ({
      id: msg.id,
      timestamp: msg.ts,
      date: new Date(msg.ts).toISOString(),
      sender: msg.sender,
      body: msg.body,
      edited: !!msg.editedAt,
      editedAt: msg.editedAt ? new Date(msg.editedAt).toISOString() : null,
      deleted: !!msg.isDeleted,
      deletedAt: msg.deletedAt ? new Date(msg.deletedAt).toISOString() : null,
    })),
  }, null, 2);
}

function formatAsHtml(messages: any[], chatTitle: string): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${chatTitle} - Chat Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .message {
      background: white;
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .message.deleted {
      opacity: 0.6;
      background: #f0f0f0;
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .sender {
      font-weight: bold;
      color: #0066cc;
    }
    .timestamp {
      color: #666;
    }
    .body {
      line-height: 1.5;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      margin-left: 8px;
    }
    .badge.edited {
      background: #fff3cd;
      color: #856404;
    }
    .badge.deleted {
      background: #f8d7da;
      color: #721c24;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${chatTitle}</h1>
    <p>Exported: ${new Date().toLocaleString()}</p>
    <p>Total Messages: ${messages.length}</p>
  </div>
`;

  for (const msg of messages) {
    const date = new Date(msg.ts).toLocaleString();
    const deletedClass = msg.isDeleted ? ' deleted' : '';
    const editedBadge = msg.editedAt ? '<span class="badge edited">EDITED</span>' : '';
    const deletedBadge = msg.isDeleted ? '<span class="badge deleted">DELETED</span>' : '';

    html += `
  <div class="message${deletedClass}">
    <div class="message-header">
      <span class="sender">${msg.sender}${editedBadge}${deletedBadge}</span>
      <span class="timestamp">${date}</span>
    </div>
    <div class="body">${msg.body}</div>
  </div>
`;
  }

  html += `
</body>
</html>`;

  return html;
}

ipcMain.handle('update-presence', async (event, userId: string, status: 'online' | 'offline' | 'away') => {
  try {
    services.presence.updatePresence(userId, status);
    if (wsServer) {
      wsServer.broadcastPresenceChanged(userId, status, Date.now());
    }
    return { success: true };
  } catch (error) {
    console.error('Error updating presence:', error);
    return { success: false, error: 'Failed to update presence' };
  }
});

ipcMain.handle('get-user-presence', async (event, userId: string) => {
  try {
    const presence = services.presence.getUserPresence(userId);
    return { success: true, data: presence };
  } catch (error) {
    console.error('Error getting user presence:', error);
    return { success: false, error: 'Failed to get user presence' };
  }
});

ipcMain.handle('get-all-presence', async () => {
  try {
    const presence = services.presence.getAllPresence();
    return { success: true, data: presence };
  } catch (error) {
    console.error('Error getting all presence:', error);
    return { success: false, error: 'Failed to get presence data' };
  }
});

ipcMain.handle('add-mention', async (event, messageId: number, mentionedUserId: string) => {
  try {
    const mentionId = services.mentions.addMention(messageId, mentionedUserId);
    return { success: true, data: { id: mentionId, messageId, mentionedUserId } };
  } catch (error) {
    console.error('Error adding mention:', error);
    return { success: false, error: 'Failed to add mention' };
  }
});

ipcMain.handle('get-mentions-by-message', async (event, messageId: number) => {
  try {
    const mentions = services.mentions.getMentionsByMessage(messageId);
    return { success: true, data: mentions };
  } catch (error) {
    console.error('Error getting mentions by message:', error);
    return { success: false, error: 'Failed to get mentions' };
  }
});

ipcMain.handle('get-mentions-by-user', async (event, userId: string, limit: number) => {
  try {
    const messages = services.mentions.getMentionsByUser(userId, limit);
    return { success: true, data: messages };
  } catch (error) {
    console.error('Error getting mentions by user:', error);
    return { success: false, error: 'Failed to get mentions' };
  }
});

ipcMain.handle('forward-message', async (event, originalMessageId: number, targetChatId: number, sender: string) => {
  try {
    const newMessage = await services.messages.forwardMessage(originalMessageId, targetChatId, sender);
    if (!newMessage) {
      return { success: false, error: 'Failed to forward message (message may not exist or is deleted)' };
    }

    if (wsServer) {
      wsServer.broadcastMessageForwarded({
        id: newMessage.id,
        chatId: newMessage.chatId,
        originalMessageId,
        ts: newMessage.ts,
        sender: newMessage.sender,
        body: newMessage.body
      });
    }

    return { success: true, data: newMessage };
  } catch (error) {
    console.error('Error forwarding message:', error);
    return { success: false, error: 'Failed to forward message' };
  }
});

ipcMain.handle('set-disappearing-timeout', async (event, chatId: number, timeout: number | null) => {
  try {
    const success = services.chats.setDisappearingTimeout(chatId, timeout);
    if (success) {
      return { success: true };
    }
    return { success: false, error: 'Chat not found' };
  } catch (error) {
    console.error('Error setting disappearing timeout:', error);
    return { success: false, error: 'Failed to set disappearing timeout' };
  }
});

ipcMain.handle('get-disappearing-timeout', async (event, chatId: number) => {
  try {
    const timeout = services.chats.getDisappearingTimeout(chatId);
    return { success: true, data: timeout };
  } catch (error) {
    console.error('Error getting disappearing timeout:', error);
    return { success: false, error: 'Failed to get disappearing timeout' };
  }
});

ipcMain.handle('cleanup-expired-messages', async () => {
  try {
    const expiredMessages = await services.messages.getExpiredMessages();

    const deletedCount = services.messages.cleanupExpiredMessages();

    if (wsServer) {
      for (const msg of expiredMessages) {
        wsServer.broadcastMessageDeleted(msg.id);
      }
    }

    return { success: true, data: deletedCount };
  } catch (error) {
    console.error('Error cleaning up expired messages:', error);
    return { success: false, error: 'Failed to cleanup expired messages' };
  }
});

ipcMain.handle('search-messages-advanced', async (event, options: {
  query: string;
  chatId?: number;
  sender?: string;
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
}) => {
  try {
    const messages = await services.messages.searchMessagesAdvanced(options);
    return { success: true, data: messages };
  } catch (error) {
    console.error('Error performing advanced search:', error);
    return { success: false, error: 'Failed to search messages' };
  }
});

ipcMain.handle('get-all-senders', async () => {
  try {
    const senders = services.messages.getAllSenders();
    return { success: true, data: senders };
  } catch (error) {
    console.error('Error getting senders:', error);
    return { success: false, error: 'Failed to get senders' };
  }
});


ipcMain.handle('get-user-setting', async (event, key: string) => {
  try {
    const setting = services.settings.getUserSetting(key);
    return { success: true, data: setting };
  } catch (error) {
    console.error('Error getting user setting:', error);
    return { success: false, error: 'Failed to get user setting' };
  }
});

ipcMain.handle('set-user-setting', async (event, key: string, value: string) => {
  try {
    services.settings.setUserSetting(key, value);
    return { success: true };
  } catch (error) {
    console.error('Error setting user setting:', error);
    return { success: false, error: 'Failed to set user setting' };
  }
});

ipcMain.handle('delete-user-setting', async (event, key: string) => {
  try {
    const deleted = services.settings.deleteUserSetting(key);
    return { success: true, data: deleted };
  } catch (error) {
    console.error('Error deleting user setting:', error);
    return { success: false, error: 'Failed to delete user setting' };
  }
});

ipcMain.handle('get-all-settings', async () => {
  try {
    const settings = services.settings.getAllSettings();
    return { success: true, data: settings };
  } catch (error) {
    console.error('Error getting all settings:', error);
    return { success: false, error: 'Failed to get all settings' };
  }
});


ipcMain.handle('get-keyboard-shortcuts', async () => {
  try {
    const shortcuts = services.settings.getKeyboardShortcuts();
    return { success: true, data: shortcuts };
  } catch (error) {
    console.error('Error getting keyboard shortcuts:', error);
    return { success: false, error: 'Failed to get keyboard shortcuts' };
  }
});

ipcMain.handle('set-keyboard-shortcuts', async (event, shortcuts) => {
  try {
    services.settings.setKeyboardShortcuts(shortcuts);
    return { success: true };
  } catch (error) {
    console.error('Error setting keyboard shortcuts:', error);
    return { success: false, error: 'Failed to set keyboard shortcuts' };
  }
});

ipcMain.handle('reset-keyboard-shortcuts', async () => {
  try {
    const shortcuts = services.settings.resetKeyboardShortcuts();
    return { success: true, data: shortcuts };
  } catch (error) {
    console.error('Error resetting keyboard shortcuts:', error);
    return { success: false, error: 'Failed to reset keyboard shortcuts' };
  }
});


ipcMain.handle('get-notification-sound', async (event, chatId?: number) => {
  try {
    const soundId = services.settings.getNotificationSound(chatId);
    return { success: true, data: soundId };
  } catch (error) {
    console.error('Error getting notification sound:', error);
    return { success: false, error: 'Failed to get notification sound' };
  }
});

ipcMain.handle('set-notification-sound', async (event, chatId: number | null, soundId: string) => {
  try {
    services.settings.setNotificationSound(chatId, soundId);
    return { success: true };
  } catch (error) {
    console.error('Error setting notification sound:', error);
    return { success: false, error: 'Failed to set notification sound' };
  }
});

ipcMain.handle('delete-notification-sound', async (event, chatId?: number) => {
  try {
    const deleted = services.settings.deleteNotificationSound(chatId);
    return { success: true, data: deleted };
  } catch (error) {
    console.error('Error deleting notification sound:', error);
    return { success: false, error: 'Failed to delete notification sound' };
  }
});


ipcMain.handle('initiate-call', async (event, callId: string, chatId: number, callType: 'audio' | 'video', initiatedBy: string) => {
  try {
    const generatedCallId = services.calls.createCall(chatId, callType, initiatedBy);
    wsServer.broadcastCallInitiated(generatedCallId, chatId, callType, initiatedBy);
    return { success: true, data: generatedCallId };
  } catch (error) {
    console.error('Error initiating call:', error);
    return { success: false, error: 'Failed to initiate call' };
  }
});

ipcMain.handle('get-call', async (event, callId: string) => {
  try {
    const call = services.calls.getCall(callId);
    return { success: true, data: call };
  } catch (error) {
    console.error('Error getting call:', error);
    return { success: false, error: 'Failed to get call' };
  }
});

ipcMain.handle('get-calls-by-chat', async (event, chatId: number, limit: number = 50) => {
  try {
    const calls = services.calls.getCallsByChat(chatId, limit);
    return { success: true, data: calls };
  } catch (error) {
    console.error('Error getting calls:', error);
    return { success: false, error: 'Failed to get calls' };
  }
});

ipcMain.handle('get-active-call', async (event, chatId: number) => {
  try {
    const call = services.calls.getActiveCall(chatId);
    return { success: true, data: call };
  } catch (error) {
    console.error('Error getting active call:', error);
    return { success: false, error: 'Failed to get active call' };
  }
});

ipcMain.handle('answer-call', async (event, callId: string, userId: string) => {
  try {
    services.calls.answerCall(callId, userId);
    wsServer.broadcastParticipantJoinedCall(callId, userId);
    return { success: true };
  } catch (error) {
    console.error('Error answering call:', error);
    return { success: false, error: 'Failed to answer call' };
  }
});

ipcMain.handle('decline-call', async (event, callId: string, userId: string) => {
  try {
    services.calls.declineCall(callId);
    wsServer.broadcastCallDeclined(callId, userId);
    return { success: true };
  } catch (error) {
    console.error('Error declining call:', error);
    return { success: false, error: 'Failed to decline call' };
  }
});

ipcMain.handle('end-call', async (event, callId: string, userId: string) => {
  try {
    services.calls.endCall(callId);
    wsServer.broadcastCallEnded(callId, userId);
    return { success: true };
  } catch (error) {
    console.error('Error ending call:', error);
    return { success: false, error: 'Failed to end call' };
  }
});

ipcMain.handle('leave-call', async (event, callId: string, userId: string) => {
  try {
    services.calls.removeCallParticipant(callId, userId);
    wsServer.broadcastParticipantLeftCall(callId, userId);
    return { success: true };
  } catch (error) {
    console.error('Error leaving call:', error);
    return { success: false, error: 'Failed to leave call' };
  }
});

ipcMain.handle('get-call-participants', async (event, callId: string) => {
  try {
    const participants = services.calls.getCallParticipants(callId);
    return { success: true, data: participants };
  } catch (error) {
    console.error('Error getting call participants:', error);
    return { success: false, error: 'Failed to get call participants' };
  }
});

ipcMain.handle('get-active-call-participants', async (event, callId: string) => {
  try {
    const participants = services.calls.getActiveCallParticipants(callId);
    return { success: true, data: participants };
  } catch (error) {
    console.error('Error getting active call participants:', error);
    return { success: false, error: 'Failed to get active call participants' };
  }
});

ipcMain.handle('send-call-offer', async (event, callId: string, fromUserId: string, offer: string) => {
  try {
    wsServer.broadcastCallOffer(callId, fromUserId, offer);
    return { success: true };
  } catch (error) {
    console.error('Error sending call offer:', error);
    return { success: false, error: 'Failed to send call offer' };
  }
});

ipcMain.handle('send-call-answer', async (event, callId: string, fromUserId: string, answer: string) => {
  try {
    wsServer.broadcastCallAnswer(callId, fromUserId, answer);
    return { success: true };
  } catch (error) {
    console.error('Error sending call answer:', error);
    return { success: false, error: 'Failed to send call answer' };
  }
});

ipcMain.handle('send-ice-candidate', async (event, callId: string, fromUserId: string, candidate: string) => {
  try {
    wsServer.broadcastIceCandidate(callId, fromUserId, candidate);
    return { success: true };
  } catch (error) {
    console.error('Error sending ICE candidate:', error);
    return { success: false, error: 'Failed to send ICE candidate' };
  }
});

ipcMain.handle('start-screen-share', async (event, callId: string, userId: string) => {
  try {
    wsServer.broadcastScreenShareStarted(callId, userId);
    return { success: true };
  } catch (error) {
    console.error('Error starting screen share:', error);
    return { success: false, error: 'Failed to start screen share' };
  }
});

ipcMain.handle('stop-screen-share', async (event, callId: string, userId: string) => {
  try {
    wsServer.broadcastScreenShareStopped(callId, userId);
    return { success: true };
  } catch (error) {
    console.error('Error stopping screen share:', error);
    return { success: false, error: 'Failed to stop screen share' };
  }
});

ipcMain.handle('seed-database', async () => {
  try {
    db.clearDatabase();
    console.log('Database cleared');
    console.log('Seeding database...');

    const firstNames = [
      'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'James', 'Ashley', 'Christopher',
      'Amanda', 'Daniel', 'Jennifer', 'Matthew', 'Lauren', 'Andrew', 'Samantha', 'Joshua',
      'Elizabeth', 'Ryan', 'Nicole', 'Brandon', 'Sophia', 'Jacob', 'Emma', 'William',
      'Olivia', 'Alexander', 'Isabella', 'Ethan', 'Mia', 'Benjamin', 'Charlotte', 'Lucas',
      'Amelia', 'Mason', 'Harper', 'Logan', 'Evelyn', 'Oliver', 'Abigail', 'Elijah'
    ];

    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
      'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White',
      'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Hall', 'Allen', 'King'
    ];

    const messageTemplates = [
      'Hey! How are you doing?', 'Can we meet up tomorrow?', 'Thanks for your help!',
      'Let me know what you think.', 'Great work on the project!', 'I have some news to share.',
      'Can you help me with something?', 'See you soon!', 'That sounds great!',
      'Let me check and get back to you.', 'Did you see the latest update?',
      'We should catch up this weekend.', 'The meeting went really well!',
      'I found a solution to that problem.', 'Thanks for the quick response!',
      'Looking forward to working with you.', 'Have you finished the report?',
      'Let me know if you need anything.', 'That deadline is coming up fast.',
      'I appreciate your help on this.', 'Just following up on our conversation.',
      'The client was very happy with the results.', 'Can you review this when you get a chance?',
      'I have a few questions about the project.', 'Sounds good, let me know!',
      'I will get that done today.', 'Perfect timing, I was just thinking about that.',
      'We need to discuss this further.', 'Great idea! Let me look into it.',
      'I am available anytime this week.', 'Thanks for keeping me updated.',
      'This is exactly what we needed.', 'I will send you the details shortly.',
      'Let me know what works for you.', 'Looking forward to your feedback.',
      'That makes a lot of sense.', 'I will circle back on this tomorrow.',
      'Just wanted to give you a quick update.', 'Can we schedule a call?',
      'I have sent you the files.', 'Everything looks good on my end.'
    ];

    const chatIds: number[] = [];
    const now = Date.now();

    console.log('Creating 200 chats...');
    for (let i = 0; i < 200; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
      const contactName = `${firstName} ${lastName}`;

      const chatId = await services.chats.createChat({
        title: contactName,
        type: 'direct',
        participantIds: [contactName, 'Me'],
        createdBy: 'Me'
      });
      chatIds.push(chatId);

      if ((i + 1) % 50 === 0) {
        console.log(`Created ${i + 1} chats...`);
      }
    }

    console.log(`Created ${chatIds.length} chats`);
    console.log('Creating 20,000+ messages (this will take a few minutes)...');

    let messageCount = 0;
    for (let chatIndex = 0; chatIndex < chatIds.length; chatIndex++) {
      const chatId = chatIds[chatIndex];
      const firstName = firstNames[chatIndex % firstNames.length];
      const lastName = lastNames[Math.floor(chatIndex / firstNames.length) % lastNames.length];
      const contactName = `${firstName} ${lastName}`;

      const messagesPerChat = 100 + Math.floor(Math.random() * 10);

      for (let msgIndex = 0; msgIndex < messagesPerChat; msgIndex++) {
        const template = messageTemplates[messageCount % messageTemplates.length];
        const timestamp = now - (messageCount * 60000);
        const isFromMe = msgIndex % 2 === 0;
        const sender = isFromMe ? 'Me' : contactName;

        await services.messages.sendMessage({
          chatId,
          sender,
          body: template,
          timestamp
        });

        messageCount++;
      }

      if ((chatIndex + 1) % 50 === 0) {
        console.log(`Created ${messageCount} messages (${chatIndex + 1}/${chatIds.length} chats)...`);
      }
    }

    console.log(`Created ${messageCount} encrypted messages`);
    console.log('Database seeded successfully');

    return { success: true };
  } catch (error) {
    console.error('Error seeding database:', error);
    return { success: false, error: 'Failed to seed database' };
  }
});

ipcMain.handle('get-stats', async () => {
  try {
    const stats = db.getStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { success: false, error: 'Failed to get stats' };
  }
});

ipcMain.handle('get-ws-port', async () => {
  return { success: true, data: WS_PORT };
});

ipcMain.handle('simulate-disconnect', async () => {
  try {
    wsServer.disconnectAllClients();
    return { success: true };
  } catch (error) {
    console.error('Error simulating disconnect:', error);
    return { success: false, error: 'Failed to simulate disconnect' };
  }
});

ipcMain.handle('create-group-chat', async (event, title: string, createdBy: string, participantIds: string[]) => {
  try {
    const chatId = await services.chats.createChat({
      title,
      type: 'group',
      participantIds,
      createdBy
    });
    if (wsServer) {
      wsServer.broadcastGroupChatCreated(chatId, title, createdBy);
    }
    return { success: true, data: chatId };
  } catch (error) {
    console.error('Error creating group chat:', error);
    return { success: false, error: 'Failed to create group chat' };
  }
});

ipcMain.handle('add-chat-participant', async (event, chatId: number, userId: string, role: 'admin' | 'member') => {
  try {
    const success = services.chats.addParticipant(chatId, userId, role);
    if (success && wsServer) {
      wsServer.broadcastParticipantAdded(chatId, userId, role);
    }
    return success
      ? { success: true }
      : { success: false, error: 'User is already a participant or invalid chat' };
  } catch (error) {
    console.error('Error adding chat participant:', error);
    return { success: false, error: 'Failed to add participant' };
  }
});

ipcMain.handle('remove-chat-participant', async (event, chatId: number, userId: string, removedBy: string) => {
  try {
    const success = services.chats.removeParticipant(chatId, userId, removedBy);
    if (success && wsServer) {
      wsServer.broadcastParticipantRemoved(chatId, userId);
    }
    return success
      ? { success: true }
      : { success: false, error: 'Participant not found' };
  } catch (error) {
    console.error('Error removing chat participant:', error);
    return { success: false, error: 'Failed to remove participant' };
  }
});

ipcMain.handle('get-chat-participants', async (event, chatId: number) => {
  try {
    const participants = services.chats.getParticipants(chatId);
    return { success: true, data: participants };
  } catch (error) {
    console.error('Error getting chat participants:', error);
    return { success: false, error: 'Failed to get participants' };
  }
});

ipcMain.handle('update-chat-participant-role', async (event, chatId: number, userId: string, role: 'admin' | 'member', updatedBy: string) => {
  try {
    const success = services.chats.updateParticipantRole(chatId, userId, role, updatedBy);
    if (success && wsServer) {
      wsServer.broadcastParticipantRoleChanged(chatId, userId, role);
    }
    return success
      ? { success: true }
      : { success: false, error: 'Participant not found' };
  } catch (error) {
    console.error('Error updating participant role:', error);
    return { success: false, error: 'Failed to update role' };
  }
});

ipcMain.handle('get-user-chats', async (event, userId: string, limit: number, offset: number) => {
  try {
    const chats = db.getUserChats(userId, limit, offset);
    return { success: true, data: chats };
  } catch (error) {
    console.error('Error getting user chats:', error);
    return { success: false, error: 'Failed to get user chats' };
  }
});

ipcMain.handle('upload-file', async (event, fileData: { buffer: Buffer; fileName: string; mimeType: string }) => {
  try {
    const { buffer, fileName, mimeType } = fileData;

    let type: 'image' | 'file' | 'voice' | 'video' = 'file';
    if (mimeType.startsWith('image/')) {
      type = 'image';
    } else if (mimeType.startsWith('video/')) {
      type = 'video';
    } else if (mimeType.startsWith('audio/')) {
      type = 'voice';
    }

    const subDir = type === 'image' ? 'images' : type === 'video' ? 'videos' : type === 'voice' ? 'audio' : 'files';
    const filePath = await fileStorage.saveFile(Buffer.from(buffer), fileName, subDir);

    return {
      success: true,
      data: {
        filePath,
        type,
        fileSize: buffer.length
      }
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    return { success: false, error: 'Failed to upload file' };
  }
});

ipcMain.handle('download-file', async (event, filePath: string) => {
  try {
    const buffer = await fileStorage.getFile(filePath);
    return { success: true, data: buffer };
  } catch (error) {
    console.error('Error downloading file:', error);
    return { success: false, error: 'Failed to download file' };
  }
});

ipcMain.handle('delete-file', async (event, filePath: string) => {
  try {
    const success = await fileStorage.deleteFile(filePath);
    return { success };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: 'Failed to delete file' };
  }
});

ipcMain.handle('add-media-attachment', async (event, data: {
  messageId: number;
  type: 'image' | 'file' | 'voice' | 'video';
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  thumbnailPath?: string;
  duration?: number;
  width?: number;
  height?: number;
}) => {
  try {
    const attachmentId = services.media.addMediaAttachment(
      data.messageId,
      data.type,
      data.fileName,
      data.fileSize,
      data.mimeType,
      data.filePath,
      {
        thumbnailPath: data.thumbnailPath,
        duration: data.duration,
        width: data.width,
        height: data.height
      }
    );
    return { success: true, data: attachmentId };
  } catch (error) {
    console.error('Error adding media attachment:', error);
    return { success: false, error: 'Failed to add media attachment' };
  }
});

ipcMain.handle('get-media-attachments', async (event, messageId: number) => {
  try {
    const attachments = services.media.getMediaAttachments(messageId);
    return { success: true, data: attachments };
  } catch (error) {
    console.error('Error getting media attachments:', error);
    return { success: false, error: 'Failed to get media attachments' };
  }
});

ipcMain.handle('get-media-attachments-by-chat', async (event, chatId: number, type?: 'image' | 'file' | 'voice' | 'video') => {
  try {
    const attachments = services.media.getMediaAttachmentsByChat(chatId, type);
    return { success: true, data: attachments };
  } catch (error) {
    console.error('Error getting media attachments by chat:', error);
    return { success: false, error: 'Failed to get media attachments' };
  }
});

ipcMain.handle('delete-media-attachment', async (event, attachmentId: number) => {
  try {
    const attachment = services.media.getMediaAttachmentById(attachmentId);
    if (attachment) {
      await fileStorage.deleteFile(attachment.filePath);
      if (attachment.thumbnailPath) {
        await fileStorage.deleteFile(attachment.thumbnailPath);
      }
    }

    const success = services.media.deleteMediaAttachment(attachmentId);
    return { success };
  } catch (error) {
    console.error('Error deleting media attachment:', error);
    return { success: false, error: 'Failed to delete media attachment' };
  }
});

ipcMain.handle('create-poll', async (event, data: {
  messageId: number;
  question: string;
  options: string[];
  allowMultiple?: boolean;
  expiresAt?: number;
}) => {
  try {
    const { messageId, question, options, allowMultiple, expiresAt } = data;
    const pollId = services.polls.createPoll(messageId, question, options, allowMultiple, expiresAt);
    if (pollId) {
      return { success: true, data: pollId };
    }
    return { success: false, error: 'Failed to create poll' };
  } catch (error) {
    console.error('Error creating poll:', error);
    return { success: false, error: 'Failed to create poll' };
  }
});

ipcMain.handle('get-poll', async (event, pollId: number) => {
  try {
    const poll = services.polls.getPoll(pollId);
    if (poll) {
      return { success: true, data: poll };
    }
    return { success: false, error: 'Poll not found' };
  } catch (error) {
    console.error('Error getting poll:', error);
    return { success: false, error: 'Failed to get poll' };
  }
});

ipcMain.handle('get-poll-by-message', async (event, messageId: number) => {
  try {
    const poll = services.polls.getPollByMessage(messageId);
    if (poll) {
      return { success: true, data: poll };
    }
    return { success: false, error: 'Poll not found' };
  } catch (error) {
    console.error('Error getting poll by message:', error);
    return { success: false, error: 'Failed to get poll' };
  }
});

ipcMain.handle('get-poll-options', async (event, pollId: number) => {
  try {
    const options = services.polls.getPollOptions(pollId);
    return { success: true, data: options };
  } catch (error) {
    console.error('Error getting poll options:', error);
    return { success: false, error: 'Failed to get poll options' };
  }
});

ipcMain.handle('vote-poll', async (event, pollId: number, optionId: number, userId: string) => {
  try {
    const success = services.polls.votePoll(pollId, optionId, userId);
    if (success) {
      return { success: true };
    }
    return { success: false, error: 'Failed to vote (poll expired or vote already exists)' };
  } catch (error) {
    console.error('Error voting on poll:', error);
    return { success: false, error: 'Failed to vote on poll' };
  }
});

ipcMain.handle('remove-poll-vote', async (event, pollId: number, optionId: number, userId: string) => {
  try {
    const success = services.polls.removePollVote(pollId, optionId, userId);
    if (success) {
      return { success: true };
    }
    return { success: false, error: 'Vote not found' };
  } catch (error) {
    console.error('Error removing poll vote:', error);
    return { success: false, error: 'Failed to remove vote' };
  }
});

ipcMain.handle('get-poll-results', async (event, pollId: number) => {
  try {
    const results = services.polls.getPollResults(pollId);
    return { success: true, data: results };
  } catch (error) {
    console.error('Error getting poll results:', error);
    return { success: false, error: 'Failed to get poll results' };
  }
});

ipcMain.handle('get-user-poll-votes', async (event, pollId: number, userId: string) => {
  try {
    const votes = services.polls.getUserPollVotes(pollId, userId);
    return { success: true, data: votes };
  } catch (error) {
    console.error('Error getting user poll votes:', error);
    return { success: false, error: 'Failed to get user votes' };
  }
});

ipcMain.handle('schedule-message', async (event, chatId: number, sender: string, body: string, scheduledFor: number) => {
  try {
    const id = services.scheduledMessages.scheduleMessage(chatId, sender, body, scheduledFor);
    return { success: true, data: id };
  } catch (error) {
    console.error('Error scheduling message:', error);
    return { success: false, error: 'Failed to schedule message' };
  }
});

ipcMain.handle('get-scheduled-message', async (event, id: number) => {
  try {
    const message = services.scheduledMessages.getScheduledMessage(id);
    if (message) {
      return { success: true, data: message };
    }
    return { success: false, error: 'Scheduled message not found' };
  } catch (error) {
    console.error('Error getting scheduled message:', error);
    return { success: false, error: 'Failed to get scheduled message' };
  }
});

ipcMain.handle('get-scheduled-messages', async (event, chatId: number, status?: 'pending' | 'sent' | 'cancelled') => {
  try {
    const messages = services.scheduledMessages.getScheduledMessages(chatId, status);
    return { success: true, data: messages };
  } catch (error) {
    console.error('Error getting scheduled messages:', error);
    return { success: false, error: 'Failed to get scheduled messages' };
  }
});

ipcMain.handle('get-all-pending-scheduled-messages', async () => {
  try {
    const messages = services.scheduledMessages.getAllPendingScheduledMessages();
    return { success: true, data: messages };
  } catch (error) {
    console.error('Error getting pending scheduled messages:', error);
    return { success: false, error: 'Failed to get pending messages' };
  }
});

ipcMain.handle('cancel-scheduled-message', async (event, id: number) => {
  try {
    const success = services.scheduledMessages.cancelScheduledMessage(id);
    if (success) {
      return { success: true };
    }
    return { success: false, error: 'Scheduled message not found or already sent' };
  } catch (error) {
    console.error('Error cancelling scheduled message:', error);
    return { success: false, error: 'Failed to cancel scheduled message' };
  }
});

ipcMain.handle('delete-scheduled-message', async (event, id: number) => {
  try {
    const success = services.scheduledMessages.deleteScheduledMessage(id);
    if (success) {
      return { success: true };
    }
    return { success: false, error: 'Scheduled message not found' };
  } catch (error) {
    console.error('Error deleting scheduled message:', error);
    return { success: false, error: 'Failed to delete scheduled message' };
  }
});

ipcMain.handle('translate-message', async (event, data: {
  messageId: number;
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}) => {
  try {
    const { messageId, text, targetLanguage, sourceLanguage } = data;
    const result = await translationService.translateMessage(
      messageId,
      text,
      targetLanguage,
      sourceLanguage
    );
    return { success: true, data: result };
  } catch (error) {
    console.error('Error translating message:', error);
    return { success: false, error: 'Failed to translate message' };
  }
});

ipcMain.handle('detect-language', async (event, text: string) => {
  try {
    const language = await translationService.detectLanguage(text);
    return { success: true, data: language };
  } catch (error) {
    console.error('Error detecting language:', error);
    return { success: false, error: 'Failed to detect language' };
  }
});

ipcMain.handle('get-cached-translation', async (event, messageId: number, targetLanguage: string) => {
  try {
    const translation = translationService.getCachedTranslation(messageId, targetLanguage);
    if (translation) {
      return { success: true, data: translation };
    }
    return { success: false, error: 'Translation not found in cache' };
  } catch (error) {
    console.error('Error getting cached translation:', error);
    return { success: false, error: 'Failed to get cached translation' };
  }
});

ipcMain.handle('get-message-translations', async (event, messageId: number) => {
  try {
    const translations = db.getMessageTranslations(messageId);
    return { success: true, data: translations };
  } catch (error) {
    console.error('Error getting message translations:', error);
    return { success: false, error: 'Failed to get translations' };
  }
});

ipcMain.handle('clear-translation-cache', async (event, messageId: number, targetLanguage?: string) => {
  try {
    const success = translationService.clearCache(messageId, targetLanguage);
    return { success };
  } catch (error) {
    console.error('Error clearing translation cache:', error);
    return { success: false, error: 'Failed to clear cache' };
  }
});

ipcMain.handle('get-supported-languages', async () => {
  try {
    const languages = await translationService.getSupportedLanguages();
    return { success: true, data: languages };
  } catch (error) {
    console.error('Error getting supported languages:', error);
    return { success: false, error: 'Failed to get supported languages' };
  }
});

ipcMain.handle('get-contacts', async (_event, limit: number, offset: number) => {
  try {
    const contacts = services.contacts.getContacts(limit, offset);
    return { success: true, data: contacts };
  } catch (error) {
    console.error('Error getting contacts:', error);
    return { success: false, error: 'Failed to get contacts' };
  }
});

ipcMain.handle('search-contacts', async (_event, query: string) => {
  try {
    const contacts = services.contacts.searchContacts(query);
    return { success: true, data: contacts };
  } catch (error) {
    console.error('Error searching contacts:', error);
    return { success: false, error: 'Failed to search contacts' };
  }
});

ipcMain.handle('create-chat-with-contact', async (_event, contactUserId: string) => {
  try {
    const chatId = services.contacts.createChatWithContact(contactUserId);
    if (chatId) {
      return { success: true, data: chatId };
    } else {
      return { success: false, error: 'Contact not found or chat creation failed' };
    }
  } catch (error) {
    console.error('Error creating chat with contact:', error);
    return { success: false, error: 'Failed to create chat' };
  }
});

ipcMain.handle('clear-database', async () => {
  try {
    db.clearDatabase();
    return { success: true };
  } catch (error) {
    console.error('Error clearing database:', error);
    return { success: false, error: 'Failed to clear database' };
  }
});


ipcMain.handle('auth:signup', async (event, username: string, password: string, email?: string, displayName?: string) => {
  try {
    const result = await services.auth.signup({ username, password, email, displayName });
    console.log('[Auth] User registered and encryption key derived');
    return { success: true, data: result };
  } catch (error) {
    console.error('Error during signup:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to create account';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('auth:login', async (event, username: string, password: string) => {
  try {
    const result = await services.auth.login(username, password);
    console.log('[Auth] User logged in successfully and encryption key derived');
    return { success: true, data: result };
  } catch (error) {
    console.error('Error during login:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to login';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('auth:logout', async (event, token: string) => {
  try {
    services.auth.logout(token);
    return { success: true };
  } catch (error) {
    console.error('Error during logout:', error);
    return { success: false, error: 'Failed to logout' };
  }
});

ipcMain.handle('auth:validate-session', async (event, token: string) => {
  try {
    const session = services.auth.validateSession(token);
    if (!session) {
      return { success: false, error: 'Invalid or expired session' };
    }

    const user = services.auth.getUser(session.userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    return {
      success: true,
      data: {
        user,
        session: {
          token: session.token,
          expiresAt: session.expiresAt,
        }
      }
    };
  } catch (error) {
    console.error('Error validating session:', error);
    return { success: false, error: 'Failed to validate session' };
  }
});

ipcMain.handle('auth:get-user-sessions', async (event, userId: number) => {
  try {
    const sessions = services.auth.getUserSessions(userId);
    return { success: true, data: sessions };
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return { success: false, error: 'Failed to get sessions' };
  }
});

ipcMain.handle('auth:destroy-all-sessions', async (event, userId: number) => {
  try {
    services.auth.revokeAllSessions(userId);
    return { success: true };
  } catch (error) {
    console.error('Error destroying all sessions:', error);
    return { success: false, error: 'Failed to destroy sessions' };
  }
});


ipcMain.handle('decrypt-message', async (event, ciphertext: string) => {
  try {
    if (!securityService.isEncrypted(ciphertext)) {
      return { success: true, data: ciphertext };
    }

    const plaintext = securityService.decrypt(ciphertext);
    return { success: true, data: plaintext };
  } catch (error) {
    console.error('Error decrypting message:', error);
    return { success: false, error: 'Failed to decrypt message', data: '[Decryption failed]' };
  }
});

ipcMain.handle('is-encrypted', async (event, data: string) => {
  try {
    const isEncrypted = securityService.isEncrypted(data);
    return { success: true, data: isEncrypted };
  } catch (error) {
    return { success: false, error: 'Failed to check encryption status' };
  }
});
