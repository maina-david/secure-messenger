import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getChats: (limit: number, offset: number) =>
    ipcRenderer.invoke('get-chats', limit, offset),

  getMessages: (chatId: number, limit: number, offset: number) =>
    ipcRenderer.invoke('get-messages', chatId, limit, offset),

  markChatRead: (chatId: number) =>
    ipcRenderer.invoke('mark-chat-read', chatId),

  sendMessage: (chatId: number, sender: string, body: string) =>
    ipcRenderer.invoke('send-message', chatId, sender, body),

  editMessage: (messageId: number, newBody: string) =>
    ipcRenderer.invoke('edit-message', messageId, newBody),

  deleteMessage: (messageId: number) =>
    ipcRenderer.invoke('delete-message', messageId),

  addReaction: (messageId: number, chatId: number, userId: string, emoji: string) =>
    ipcRenderer.invoke('add-reaction', messageId, chatId, userId, emoji),

  removeReaction: (messageId: number, userId: string, emoji: string) =>
    ipcRenderer.invoke('remove-reaction', messageId, userId, emoji),

  getReactions: (messageId: number) =>
    ipcRenderer.invoke('get-reactions', messageId),

  getReactionsByChat: (chatId: number) =>
    ipcRenderer.invoke('get-reactions-by-chat', chatId),

  markMessageRead: (messageId: number, userId: string) =>
    ipcRenderer.invoke('mark-message-read', messageId, userId),

  getReadReceipts: (messageId: number) =>
    ipcRenderer.invoke('get-read-receipts', messageId),

  getReadReceiptsByChat: (chatId: number) =>
    ipcRenderer.invoke('get-read-receipts-by-chat', chatId),

  saveDraft: (chatId: number, content: string) =>
    ipcRenderer.invoke('save-draft', chatId, content),

  getDraft: (chatId: number) =>
    ipcRenderer.invoke('get-draft', chatId),

  deleteDraft: (chatId: number) =>
    ipcRenderer.invoke('delete-draft', chatId),

  searchMessages: (chatId: number, query: string, limit: number) =>
    ipcRenderer.invoke('search-messages', chatId, query, limit),

  searchAllMessages: (query: string, limit: number) =>
    ipcRenderer.invoke('search-all-messages', query, limit),

  // Reply operations
  setMessageReply: (messageId: number, replyToMessageId: number) =>
    ipcRenderer.invoke('set-message-reply', messageId, replyToMessageId),

  getMessageReply: (messageId: number) =>
    ipcRenderer.invoke('get-message-reply', messageId),

  getRepliesTo: (messageId: number) =>
    ipcRenderer.invoke('get-replies-to', messageId),

  deleteMessageReply: (messageId: number) =>
    ipcRenderer.invoke('delete-message-reply', messageId),

  // Pinned message operations
  pinMessage: (messageId: number, chatId: number, pinnedBy: string) =>
    ipcRenderer.invoke('pin-message', messageId, chatId, pinnedBy),

  unpinMessage: (messageId: number, chatId: number) =>
    ipcRenderer.invoke('unpin-message', messageId, chatId),

  getPinnedMessages: (chatId: number) =>
    ipcRenderer.invoke('get-pinned-messages', chatId),

  isPinned: (messageId: number, chatId: number) =>
    ipcRenderer.invoke('is-pinned', messageId, chatId),

  // Export operations
  exportMessages: (chatId: number, format: 'txt' | 'json' | 'html') =>
    ipcRenderer.invoke('export-messages', chatId, format),

  // Presence operations
  updatePresence: (userId: string, status: 'online' | 'offline' | 'away') =>
    ipcRenderer.invoke('update-presence', userId, status),

  getUserPresence: (userId: string) =>
    ipcRenderer.invoke('get-user-presence', userId),

  getAllPresence: () =>
    ipcRenderer.invoke('get-all-presence'),

  // Mention operations
  addMention: (messageId: number, mentionedUserId: string) =>
    ipcRenderer.invoke('add-mention', messageId, mentionedUserId),

  getMentionsByMessage: (messageId: number) =>
    ipcRenderer.invoke('get-mentions-by-message', messageId),

  getMentionsByUser: (userId: string, limit: number) =>
    ipcRenderer.invoke('get-mentions-by-user', userId, limit),

  // Message forwarding operations
  forwardMessage: (originalMessageId: number, targetChatId: number, sender: string) =>
    ipcRenderer.invoke('forward-message', originalMessageId, targetChatId, sender),

  // Disappearing messages operations
  setDisappearingTimeout: (chatId: number, timeout: number | null) =>
    ipcRenderer.invoke('set-disappearing-timeout', chatId, timeout),

  getDisappearingTimeout: (chatId: number) =>
    ipcRenderer.invoke('get-disappearing-timeout', chatId),

  cleanupExpiredMessages: () =>
    ipcRenderer.invoke('cleanup-expired-messages'),

  // Advanced search operations
  searchMessagesAdvanced: (options: {
    query: string;
    chatId?: number;
    sender?: string;
    dateFrom?: number;
    dateTo?: number;
    limit?: number;
  }) =>
    ipcRenderer.invoke('search-messages-advanced', options),

  getAllSenders: () =>
    ipcRenderer.invoke('get-all-senders'),

  // Group chat operations
  createGroupChat: (title: string, createdBy: string, participantIds: string[]) =>
    ipcRenderer.invoke('create-group-chat', title, createdBy, participantIds),

  addChatParticipant: (chatId: number, userId: string, role: 'admin' | 'member') =>
    ipcRenderer.invoke('add-chat-participant', chatId, userId, role),

  removeChatParticipant: (chatId: number, userId: string) =>
    ipcRenderer.invoke('remove-chat-participant', chatId, userId),

  getChatParticipants: (chatId: number) =>
    ipcRenderer.invoke('get-chat-participants', chatId),

  updateChatParticipantRole: (chatId: number, userId: string, role: 'admin' | 'member') =>
    ipcRenderer.invoke('update-chat-participant-role', chatId, userId, role),

  getUserChats: (userId: string, limit: number, offset: number) =>
    ipcRenderer.invoke('get-user-chats', userId, limit, offset),

  // File and media operations
  uploadFile: (fileData: { buffer: ArrayBuffer; fileName: string; mimeType: string }) =>
    ipcRenderer.invoke('upload-file', fileData),

  downloadFile: (filePath: string) =>
    ipcRenderer.invoke('download-file', filePath),

  deleteFile: (filePath: string) =>
    ipcRenderer.invoke('delete-file', filePath),

  addMediaAttachment: (data: {
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
  }) =>
    ipcRenderer.invoke('add-media-attachment', data),

  getMediaAttachments: (messageId: number) =>
    ipcRenderer.invoke('get-media-attachments', messageId),

  getMediaAttachmentsByChat: (chatId: number, type?: 'image' | 'file' | 'voice' | 'video') =>
    ipcRenderer.invoke('get-media-attachments-by-chat', chatId, type),

  deleteMediaAttachment: (attachmentId: number) =>
    ipcRenderer.invoke('delete-media-attachment', attachmentId),

  // Poll operations
  createPoll: (data: {
    messageId: number;
    question: string;
    options: string[];
    allowMultiple?: boolean;
    expiresAt?: number;
  }) =>
    ipcRenderer.invoke('create-poll', data),

  getPoll: (pollId: number) =>
    ipcRenderer.invoke('get-poll', pollId),

  getPollByMessage: (messageId: number) =>
    ipcRenderer.invoke('get-poll-by-message', messageId),

  getPollOptions: (pollId: number) =>
    ipcRenderer.invoke('get-poll-options', pollId),

  votePoll: (pollId: number, optionId: number, userId: string) =>
    ipcRenderer.invoke('vote-poll', pollId, optionId, userId),

  removePollVote: (pollId: number, optionId: number, userId: string) =>
    ipcRenderer.invoke('remove-poll-vote', pollId, optionId, userId),

  getPollResults: (pollId: number) =>
    ipcRenderer.invoke('get-poll-results', pollId),

  getUserPollVotes: (pollId: number, userId: string) =>
    ipcRenderer.invoke('get-user-poll-votes', pollId, userId),

  // Scheduled message operations
  scheduleMessage: (chatId: number, sender: string, body: string, scheduledFor: number) =>
    ipcRenderer.invoke('schedule-message', chatId, sender, body, scheduledFor),

  getScheduledMessage: (id: number) =>
    ipcRenderer.invoke('get-scheduled-message', id),

  getScheduledMessages: (chatId: number, status?: 'pending' | 'sent' | 'cancelled') =>
    ipcRenderer.invoke('get-scheduled-messages', chatId, status),

  getAllPendingScheduledMessages: () =>
    ipcRenderer.invoke('get-all-pending-scheduled-messages'),

  cancelScheduledMessage: (id: number) =>
    ipcRenderer.invoke('cancel-scheduled-message', id),

  deleteScheduledMessage: (id: number) =>
    ipcRenderer.invoke('delete-scheduled-message', id),

  // Translation operations
  translateMessage: (data: {
    messageId: number;
    text: string;
    targetLanguage: string;
    sourceLanguage?: string;
  }) =>
    ipcRenderer.invoke('translate-message', data),

  detectLanguage: (text: string) =>
    ipcRenderer.invoke('detect-language', text),

  getCachedTranslation: (messageId: number, targetLanguage: string) =>
    ipcRenderer.invoke('get-cached-translation', messageId, targetLanguage),

  getMessageTranslations: (messageId: number) =>
    ipcRenderer.invoke('get-message-translations', messageId),

  clearTranslationCache: (messageId: number, targetLanguage?: string) =>
    ipcRenderer.invoke('clear-translation-cache', messageId, targetLanguage),

  getSupportedLanguages: () =>
    ipcRenderer.invoke('get-supported-languages'),

  // Database operations
  clearDatabase: () =>
    ipcRenderer.invoke('clear-database'),

  seedDatabase: () =>
    ipcRenderer.invoke('seed-database'),

  getStats: () =>
    ipcRenderer.invoke('get-stats'),

  // WebSocket operations
  getWsPort: () =>
    ipcRenderer.invoke('get-ws-port'),

  simulateDisconnect: () =>
    ipcRenderer.invoke('simulate-disconnect'),

  // User settings operations
  getUserSetting: (key: string) =>
    ipcRenderer.invoke('get-user-setting', key),

  setUserSetting: (key: string, value: string) =>
    ipcRenderer.invoke('set-user-setting', key, value),

  deleteUserSetting: (key: string) =>
    ipcRenderer.invoke('delete-user-setting', key),

  getAllSettings: () =>
    ipcRenderer.invoke('get-all-settings'),

  // Keyboard shortcuts operations
  getKeyboardShortcuts: () =>
    ipcRenderer.invoke('get-keyboard-shortcuts'),

  setKeyboardShortcuts: (shortcuts: any) =>
    ipcRenderer.invoke('set-keyboard-shortcuts', shortcuts),

  resetKeyboardShortcuts: () =>
    ipcRenderer.invoke('reset-keyboard-shortcuts'),

  // Notification settings operations
  getNotificationSound: (chatId?: number) =>
    ipcRenderer.invoke('get-notification-sound', chatId),

  setNotificationSound: (chatId: number | null, soundId: string) =>
    ipcRenderer.invoke('set-notification-sound', chatId, soundId),

  deleteNotificationSound: (chatId?: number) =>
    ipcRenderer.invoke('delete-notification-sound', chatId),

  // WebRTC Calls operations
  initiateCall: (callId: string, chatId: number, callType: 'audio' | 'video', initiatedBy: string) =>
    ipcRenderer.invoke('initiate-call', callId, chatId, callType, initiatedBy),

  getCall: (callId: string) =>
    ipcRenderer.invoke('get-call', callId),

  getCallsByChat: (chatId: number, limit?: number) =>
    ipcRenderer.invoke('get-calls-by-chat', chatId, limit),

  getActiveCall: (chatId: number) =>
    ipcRenderer.invoke('get-active-call', chatId),

  answerCall: (callId: string, userId: string) =>
    ipcRenderer.invoke('answer-call', callId, userId),

  declineCall: (callId: string, userId: string) =>
    ipcRenderer.invoke('decline-call', callId, userId),

  endCall: (callId: string, userId: string) =>
    ipcRenderer.invoke('end-call', callId, userId),

  leaveCall: (callId: string, userId: string) =>
    ipcRenderer.invoke('leave-call', callId, userId),

  getCallParticipants: (callId: string) =>
    ipcRenderer.invoke('get-call-participants', callId),

  getActiveCallParticipants: (callId: string) =>
    ipcRenderer.invoke('get-active-call-participants', callId),

  // WebRTC Signaling
  sendCallOffer: (callId: string, fromUserId: string, offer: string) =>
    ipcRenderer.invoke('send-call-offer', callId, fromUserId, offer),

  sendCallAnswer: (callId: string, fromUserId: string, answer: string) =>
    ipcRenderer.invoke('send-call-answer', callId, fromUserId, answer),

  sendIceCandidate: (callId: string, fromUserId: string, candidate: string) =>
    ipcRenderer.invoke('send-ice-candidate', callId, fromUserId, candidate),

  // Screen Sharing
  startScreenShare: (callId: string, userId: string) =>
    ipcRenderer.invoke('start-screen-share', callId, userId),

  stopScreenShare: (callId: string, userId: string) =>
    ipcRenderer.invoke('stop-screen-share', callId, userId),

  // Contacts
  getContacts: (limit: number, offset: number) =>
    ipcRenderer.invoke('get-contacts', limit, offset),

  searchContacts: (query: string) =>
    ipcRenderer.invoke('search-contacts', query),

  createChatWithContact: (contactUserId: string) =>
    ipcRenderer.invoke('create-chat-with-contact', contactUserId),

  // Authentication operations
  authSignup: (username: string, password: string, email?: string, displayName?: string) =>
    ipcRenderer.invoke('auth:signup', username, password, email, displayName),

  authLogin: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', username, password),

  authLogout: (token: string) =>
    ipcRenderer.invoke('auth:logout', token),

  authValidateSession: (token: string) =>
    ipcRenderer.invoke('auth:validate-session', token),

  authGetUserSessions: (userId: number) =>
    ipcRenderer.invoke('auth:get-user-sessions', userId),

  authDestroyAllSessions: (userId: number) =>
    ipcRenderer.invoke('auth:destroy-all-sessions', userId),

  // Delivery status operations
  markMessageDelivered: (messageId: number) =>
    ipcRenderer.invoke('mark-message-delivered', messageId),

  getDeliveryStatus: (messageId: number) =>
    ipcRenderer.invoke('get-delivery-status', messageId),

  // Encryption operations
  decryptMessage: (ciphertext: string) =>
    ipcRenderer.invoke('decrypt-message', ciphertext),

  isEncrypted: (data: string) =>
    ipcRenderer.invoke('is-encrypted', data),
});
