export interface Chat {
  id: number;
  title: string;
  lastMessageAt: number;
  unreadCount: number;
  disappearingMessageTimeout?: number | null;
  type?: 'direct' | 'group';
  createdBy?: string | null;
}

export interface ChatParticipant {
  id: number;
  chatId: number;
  userId: string;
  role: 'admin' | 'member';
  joinedAt: number;
}

export interface MediaAttachment {
  id: number;
  messageId: number;
  type: 'image' | 'file' | 'voice' | 'video';
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  thumbnailPath?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  uploadedAt: number;
}

export interface Poll {
  id: number;
  messageId: number;
  question: string;
  allowMultiple: number;
  expiresAt?: number | null;
  createdAt: number;
}

export interface PollOption {
  id: number;
  pollId: number;
  optionText: string;
  optionIndex: number;
}

export interface PollVote {
  id: number;
  pollId: number;
  optionId: number;
  userId: string;
  votedAt: number;
}

export interface PollResults {
  [optionId: number]: {
    optionId: number;
    optionText: string;
    count: number;
    voters: string[];
  };
}

export interface ScheduledMessage {
  id: number;
  chatId: number;
  sender: string;
  body: string;
  scheduledFor: number;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: number;
  sentAt?: number | null;
}

export interface MessageTranslation {
  messageId: number;
  targetLanguage: string;
  translatedText: string;
  translatedAt: number;
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  provider: string;
}

export interface Message {
  id: number;
  chatId: number;
  ts: number;
  sender: string;
  body: string;
  editedAt?: number | null;
  deletedAt?: number | null;
  isDeleted?: number;
  forwardedFrom?: number | null;
  forwardCount?: number;
  expiresAt?: number | null;
}

export interface Reaction {
  id: number;
  messageId: number;
  chatId: number;
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface ReadReceipt {
  messageId: number;
  userId: string;
  readAt: number;
}

export interface PinnedMessage {
  id: number;
  messageId: number;
  chatId: number;
  pinnedBy: string;
  pinnedAt: number;
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
  updatedAt: number;
}

export interface Mention {
  id: number;
  messageId: number;
  mentionedUserId: string;
}

export interface SearchOptions {
  query: string;
  chatId?: number;
  sender?: string;
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
}

export interface UserSetting {
  key: string;
  value: string;
  updatedAt: number;
}

export interface KeyboardShortcut {
  action: string;
  key: string;
  modifiers: string[]; // ['Ctrl', 'Shift', 'Alt', 'Meta']
  description: string;
}

export interface Call {
  id: string; // UUID
  chatId: number;
  type: 'audio' | 'video';
  initiatedBy: string;
  startedAt: number;
  endedAt?: number | null;
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
}

export interface CallParticipant {
  id: number;
  callId: string;
  userId: string;
  joinedAt?: number | null;
  leftAt?: number | null;
}

export interface Contact {
  id: number;
  userId: string;
  name: string;
  avatar?: string | null;
  status?: string | null;
  lastSeen?: number | null;
  createdAt: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ElectronAPI {
  getChats: (limit: number, offset: number) => Promise<ApiResponse<Chat[]>>;
  getMessages: (chatId: number, limit: number, offset: number) => Promise<ApiResponse<Message[]>>;
  markChatRead: (chatId: number) => Promise<ApiResponse<void>>;
  sendMessage: (chatId: number, sender: string, body: string) => Promise<ApiResponse<Message>>;
  editMessage: (messageId: number, newBody: string) => Promise<ApiResponse<Message>>;
  deleteMessage: (messageId: number) => Promise<ApiResponse<void>>;
  createGroupChat: (title: string, createdBy: string, participantIds: string[]) => Promise<ApiResponse<number>>;
  addChatParticipant: (chatId: number, userId: string, role: 'admin' | 'member') => Promise<ApiResponse<void>>;
  removeChatParticipant: (chatId: number, userId: string) => Promise<ApiResponse<void>>;
  getChatParticipants: (chatId: number) => Promise<ApiResponse<ChatParticipant[]>>;
  updateChatParticipantRole: (chatId: number, userId: string, role: 'admin' | 'member') => Promise<ApiResponse<void>>;
  getUserChats: (userId: string, limit: number, offset: number) => Promise<ApiResponse<Chat[]>>;
  uploadFile: (fileData: { buffer: ArrayBuffer; fileName: string; mimeType: string }) => Promise<ApiResponse<{ filePath: string; type: 'image' | 'file' | 'voice' | 'video'; fileSize: number }>>;
  downloadFile: (filePath: string) => Promise<ApiResponse<ArrayBuffer>>;
  deleteFile: (filePath: string) => Promise<ApiResponse<void>>;
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
  }) => Promise<ApiResponse<number>>;
  getMediaAttachments: (messageId: number) => Promise<ApiResponse<MediaAttachment[]>>;
  getMediaAttachmentsByChat: (chatId: number, type?: 'image' | 'file' | 'voice' | 'video') => Promise<ApiResponse<MediaAttachment[]>>;
  deleteMediaAttachment: (attachmentId: number) => Promise<ApiResponse<void>>;
  createPoll: (data: {
    messageId: number;
    question: string;
    options: string[];
    allowMultiple?: boolean;
    expiresAt?: number;
  }) => Promise<ApiResponse<number>>;
  getPoll: (pollId: number) => Promise<ApiResponse<Poll>>;
  getPollByMessage: (messageId: number) => Promise<ApiResponse<Poll>>;
  getPollOptions: (pollId: number) => Promise<ApiResponse<PollOption[]>>;
  votePoll: (pollId: number, optionId: number, userId: string) => Promise<ApiResponse<void>>;
  removePollVote: (pollId: number, optionId: number, userId: string) => Promise<ApiResponse<void>>;
  getPollResults: (pollId: number) => Promise<ApiResponse<PollResults>>;
  getUserPollVotes: (pollId: number, userId: string) => Promise<ApiResponse<number[]>>;
  scheduleMessage: (chatId: number, sender: string, body: string, scheduledFor: number) => Promise<ApiResponse<number>>;
  getScheduledMessage: (id: number) => Promise<ApiResponse<ScheduledMessage>>;
  getScheduledMessages: (chatId: number, status?: 'pending' | 'sent' | 'cancelled') => Promise<ApiResponse<ScheduledMessage[]>>;
  getAllPendingScheduledMessages: () => Promise<ApiResponse<ScheduledMessage[]>>;
  cancelScheduledMessage: (id: number) => Promise<ApiResponse<void>>;
  deleteScheduledMessage: (id: number) => Promise<ApiResponse<void>>;
  translateMessage: (data: {
    messageId: number;
    text: string;
    targetLanguage: string;
    sourceLanguage?: string;
  }) => Promise<ApiResponse<TranslationResult>>;
  detectLanguage: (text: string) => Promise<ApiResponse<string>>;
  getCachedTranslation: (messageId: number, targetLanguage: string) => Promise<ApiResponse<string>>;
  getMessageTranslations: (messageId: number) => Promise<ApiResponse<MessageTranslation[]>>;
  clearTranslationCache: (messageId: number, targetLanguage?: string) => Promise<ApiResponse<void>>;
  getSupportedLanguages: () => Promise<ApiResponse<string[]>>;
  addReaction: (messageId: number, chatId: number, userId: string, emoji: string) => Promise<ApiResponse<Reaction>>;
  removeReaction: (messageId: number, userId: string, emoji: string) => Promise<ApiResponse<void>>;
  getReactions: (messageId: number) => Promise<ApiResponse<Reaction[]>>;
  getReactionsByChat: (chatId: number) => Promise<ApiResponse<Record<number, Reaction[]>>>;
  markMessageRead: (messageId: number, userId: string) => Promise<ApiResponse<void>>;
  getReadReceipts: (messageId: number) => Promise<ApiResponse<ReadReceipt[]>>;
  getReadReceiptsByChat: (chatId: number) => Promise<ApiResponse<Record<number, ReadReceipt[]>>>;
  saveDraft: (chatId: number, content: string) => Promise<ApiResponse<void>>;
  getDraft: (chatId: number) => Promise<ApiResponse<string | null>>;
  deleteDraft: (chatId: number) => Promise<ApiResponse<void>>;
  searchMessages: (chatId: number, query: string, limit: number) => Promise<ApiResponse<Message[]>>;
  searchAllMessages: (query: string, limit: number) => Promise<ApiResponse<Message[]>>;
  setMessageReply: (messageId: number, replyToMessageId: number) => Promise<ApiResponse<void>>;
  getMessageReply: (messageId: number) => Promise<ApiResponse<number | null>>;
  getRepliesTo: (messageId: number) => Promise<ApiResponse<Message[]>>;
  deleteMessageReply: (messageId: number) => Promise<ApiResponse<void>>;
  pinMessage: (messageId: number, chatId: number, pinnedBy: string) => Promise<ApiResponse<PinnedMessage>>;
  unpinMessage: (messageId: number, chatId: number) => Promise<ApiResponse<void>>;
  getPinnedMessages: (chatId: number) => Promise<ApiResponse<PinnedMessage[]>>;
  isPinned: (messageId: number, chatId: number) => Promise<ApiResponse<boolean>>;
  exportMessages: (chatId: number, format: 'txt' | 'json' | 'html') => Promise<ApiResponse<string>>;
  updatePresence: (userId: string, status: 'online' | 'offline' | 'away') => Promise<ApiResponse<void>>;
  getUserPresence: (userId: string) => Promise<ApiResponse<UserPresence | null>>;
  getAllPresence: () => Promise<ApiResponse<UserPresence[]>>;
  addMention: (messageId: number, mentionedUserId: string) => Promise<ApiResponse<Mention>>;
  getMentionsByMessage: (messageId: number) => Promise<ApiResponse<Mention[]>>;
  getMentionsByUser: (userId: string, limit: number) => Promise<ApiResponse<Message[]>>;
  forwardMessage: (originalMessageId: number, targetChatId: number, sender: string) => Promise<ApiResponse<Message>>;
  setDisappearingTimeout: (chatId: number, timeout: number | null) => Promise<ApiResponse<void>>;
  getDisappearingTimeout: (chatId: number) => Promise<ApiResponse<number | null>>;
  cleanupExpiredMessages: () => Promise<ApiResponse<number>>;
  searchMessagesAdvanced: (options: SearchOptions) => Promise<ApiResponse<Message[]>>;
  getAllSenders: () => Promise<ApiResponse<string[]>>;
  clearDatabase: () => Promise<ApiResponse<void>>;
  seedDatabase: () => Promise<ApiResponse<void>>;
  getStats: () => Promise<ApiResponse<{ chats: number; messages: number }>>;
  getWsPort: () => Promise<ApiResponse<number>>;
  simulateDisconnect: () => Promise<ApiResponse<void>>;
  getUserSetting: (key: string) => Promise<ApiResponse<UserSetting | null>>;
  setUserSetting: (key: string, value: string) => Promise<ApiResponse<void>>;
  deleteUserSetting: (key: string) => Promise<ApiResponse<boolean>>;
  getAllSettings: () => Promise<ApiResponse<UserSetting[]>>;
  getKeyboardShortcuts: () => Promise<ApiResponse<KeyboardShortcut[]>>;
  setKeyboardShortcuts: (shortcuts: KeyboardShortcut[]) => Promise<ApiResponse<void>>;
  resetKeyboardShortcuts: () => Promise<ApiResponse<KeyboardShortcut[]>>;
  getNotificationSound: (chatId?: number) => Promise<ApiResponse<string | null>>;
  setNotificationSound: (chatId: number | null, soundId: string) => Promise<ApiResponse<void>>;
  deleteNotificationSound: (chatId?: number) => Promise<ApiResponse<boolean>>;
  initiateCall: (callId: string, chatId: number, callType: 'audio' | 'video', initiatedBy: string) => Promise<ApiResponse<string>>;
  getCall: (callId: string) => Promise<ApiResponse<Call | null>>;
  getCallsByChat: (chatId: number, limit?: number) => Promise<ApiResponse<Call[]>>;
  getActiveCall: (chatId: number) => Promise<ApiResponse<Call | null>>;
  answerCall: (callId: string, userId: string) => Promise<ApiResponse<void>>;
  declineCall: (callId: string, userId: string) => Promise<ApiResponse<void>>;
  endCall: (callId: string, userId: string) => Promise<ApiResponse<void>>;
  leaveCall: (callId: string, userId: string) => Promise<ApiResponse<void>>;
  getCallParticipants: (callId: string) => Promise<ApiResponse<CallParticipant[]>>;
  getActiveCallParticipants: (callId: string) => Promise<ApiResponse<CallParticipant[]>>;
  sendCallOffer: (callId: string, fromUserId: string, offer: string) => Promise<ApiResponse<void>>;
  sendCallAnswer: (callId: string, fromUserId: string, answer: string) => Promise<ApiResponse<void>>;
  sendIceCandidate: (callId: string, fromUserId: string, candidate: string) => Promise<ApiResponse<void>>;
  startScreenShare: (callId: string, userId: string) => Promise<ApiResponse<void>>;
  stopScreenShare: (callId: string, userId: string) => Promise<ApiResponse<void>>;

  // Contacts
  getContacts: (limit: number, offset: number) => Promise<ApiResponse<Contact[]>>;
  searchContacts: (query: string) => Promise<ApiResponse<Contact[]>>;
  createChatWithContact: (contactUserId: string) => Promise<ApiResponse<number>>;

  // Authentication
  authSignup: (username: string, password: string, email?: string, displayName?: string) => Promise<ApiResponse<{
    user: {
      id: number;
      username: string;
      email?: string | null;
      displayName?: string | null;
    };
    session: {
      token: string;
      expiresAt: number;
    };
  }>>;
  authLogin: (username: string, password: string) => Promise<ApiResponse<{
    user: {
      id: number;
      username: string;
      email?: string | null;
      displayName?: string | null;
    };
    session: {
      token: string;
      expiresAt: number;
    };
  }>>;
  authLogout: (token: string) => Promise<ApiResponse<void>>;
  authValidateSession: (token: string) => Promise<ApiResponse<{
    user: {
      id: number;
      username: string;
      email?: string | null;
      displayName?: string | null;
    };
    session: {
      token: string;
      expiresAt: number;
    };
  }>>;
  authGetUserSessions: (userId: number) => Promise<ApiResponse<Array<{
    id: string;
    userId: number;
    token: string;
    createdAt: number;
    expiresAt: number;
    lastActivityAt: number;
  }>>>;
  authDestroyAllSessions: (userId: number) => Promise<ApiResponse<void>>;

  // Delivery status
  markMessageDelivered: (messageId: number) => Promise<ApiResponse<void>>;
  getDeliveryStatus: (messageId: number) => Promise<ApiResponse<{
    delivered: boolean;
    deliveredAt: number | null;
  }>>;

  // Encryption
  decryptMessage: (ciphertext: string) => Promise<ApiResponse<string>>;
  isEncrypted: (data: string) => Promise<ApiResponse<boolean>>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
