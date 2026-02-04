///<reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';

global.window.electronAPI = {
  // Core chat operations
  getChats: jest.fn(),
  getMessages: jest.fn(),
  markChatRead: jest.fn(),
  sendMessage: jest.fn(),
  editMessage: jest.fn(),
  deleteMessage: jest.fn(),
  markMessageRead: jest.fn(),

  // Group chat operations
  createGroupChat: jest.fn(),
  addChatParticipant: jest.fn(),
  removeChatParticipant: jest.fn(),
  getChatParticipants: jest.fn(),
  updateChatParticipantRole: jest.fn(),
  getUserChats: jest.fn(),

  // File operations
  uploadFile: jest.fn(),
  downloadFile: jest.fn(),
  deleteFile: jest.fn(),
  addMediaAttachment: jest.fn(),
  getMediaAttachments: jest.fn(),
  getMediaAttachmentsByChat: jest.fn(),
  deleteMediaAttachment: jest.fn(),

  // Poll operations
  createPoll: jest.fn(),
  getPoll: jest.fn(),
  getPollByMessage: jest.fn(),
  getPollOptions: jest.fn(),
  votePoll: jest.fn(),
  removePollVote: jest.fn(),
  getPollResults: jest.fn(),
  getUserPollVotes: jest.fn(),

  // Scheduled messages
  scheduleMessage: jest.fn(),
  getScheduledMessage: jest.fn(),
  getScheduledMessages: jest.fn(),
  getAllPendingScheduledMessages: jest.fn(),
  cancelScheduledMessage: jest.fn(),
  deleteScheduledMessage: jest.fn(),

  // Translation
  translateMessage: jest.fn(),
  detectLanguage: jest.fn(),
  getCachedTranslation: jest.fn(),
  getMessageTranslations: jest.fn(),
  clearTranslationCache: jest.fn(),
  getSupportedLanguages: jest.fn(),

  // Reactions
  addReaction: jest.fn(),
  removeReaction: jest.fn(),
  getReactions: jest.fn(),
  getReactionsByChat: jest.fn(),

  // Read receipts
  getReadReceipts: jest.fn(),
  getReadReceiptsByChat: jest.fn(),

  // Drafts
  saveDraft: jest.fn(),
  getDraft: jest.fn(),
  deleteDraft: jest.fn(),

  // Search
  searchMessages: jest.fn(),
  searchAllMessages: jest.fn(),
  searchMessagesAdvanced: jest.fn(),
  getAllSenders: jest.fn(),

  // Message replies
  setMessageReply: jest.fn(),
  getMessageReply: jest.fn(),
  getRepliesTo: jest.fn(),
  deleteMessageReply: jest.fn(),

  // Pinned messages
  pinMessage: jest.fn(),
  unpinMessage: jest.fn(),
  getPinnedMessages: jest.fn(),
  isPinned: jest.fn(),

  // Export
  exportMessages: jest.fn(),

  // Presence
  updatePresence: jest.fn(),
  getUserPresence: jest.fn(),
  getAllPresence: jest.fn(),

  // Mentions
  addMention: jest.fn(),
  getMentionsByMessage: jest.fn(),
  getMentionsByUser: jest.fn(),

  // Forwarding
  forwardMessage: jest.fn(),

  // Disappearing messages
  setDisappearingTimeout: jest.fn(),
  getDisappearingTimeout: jest.fn(),
  cleanupExpiredMessages: jest.fn(),

  // User settings
  getUserSetting: jest.fn(),
  setUserSetting: jest.fn(),
  deleteUserSetting: jest.fn(),
  getAllSettings: jest.fn(),

  // Keyboard shortcuts
  getKeyboardShortcuts: jest.fn(),
  setKeyboardShortcuts: jest.fn(),
  resetKeyboardShortcuts: jest.fn(),

  // Notification settings
  getNotificationSound: jest.fn(),
  setNotificationSound: jest.fn(),
  deleteNotificationSound: jest.fn(),

  // WebRTC Calls
  initiateCall: jest.fn(),
  getCall: jest.fn(),
  getCallsByChat: jest.fn(),
  getActiveCall: jest.fn(),
  answerCall: jest.fn(),
  declineCall: jest.fn(),
  endCall: jest.fn(),
  leaveCall: jest.fn(),
  getCallParticipants: jest.fn(),
  getActiveCallParticipants: jest.fn(),

  // WebRTC Signaling
  sendCallOffer: jest.fn(),
  sendCallAnswer: jest.fn(),
  sendIceCandidate: jest.fn(),

  // Screen Sharing
  startScreenShare: jest.fn(),
  stopScreenShare: jest.fn(),

  // Utility
  seedDatabase: jest.fn(),
  getStats: jest.fn(),
  getWsPort: jest.fn(),
  simulateDisconnect: jest.fn(),
};
