import chatsReducer, { updateChatLastMessage, markChatAsRead, fetchChats } from './chatsSlice';
import { Chat } from '../types';

describe('chatsSlice', () => {
  const initialState = {
    chats: [],
    loading: false,
    error: null,
    hasMore: true,
    offset: 0,
  };

  const mockChats: Chat[] = [
    { id: 1, title: 'Chat 1', lastMessageAt: 1000, unreadCount: 2 },
    { id: 2, title: 'Chat 2', lastMessageAt: 2000, unreadCount: 0 },
    { id: 3, title: 'Chat 3', lastMessageAt: 3000, unreadCount: 1 },
  ];

  describe('reducers', () => {
    it('should return initial state', () => {
      expect(chatsReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    it('should update chat last message and increment unread count', () => {
      const stateWithChats = {
        ...initialState,
        chats: [...mockChats],
      };

      const newState = chatsReducer(
        stateWithChats,
        updateChatLastMessage({ chatId: 1, timestamp: 5000 })
      );

      const updatedChat = newState.chats.find(c => c.id === 1);
      expect(updatedChat?.lastMessageAt).toBe(5000);
      expect(updatedChat?.unreadCount).toBe(3); // Was 2, now 3
    });

    it('should re-sort chats after updating last message', () => {
      const stateWithChats = {
        ...initialState,
        chats: [...mockChats],
      };

      // Update chat 1 with a newer timestamp (should move to top)
      const newState = chatsReducer(
        stateWithChats,
        updateChatLastMessage({ chatId: 1, timestamp: 5000 })
      );

      expect(newState.chats[0].id).toBe(1); // Chat 1 should now be first
      expect(newState.chats[0].lastMessageAt).toBe(5000);
    });

    it('should mark chat as read', () => {
      const stateWithChats = {
        ...initialState,
        chats: [...mockChats],
      };

      const newState = chatsReducer(stateWithChats, markChatAsRead(1));

      const chat = newState.chats.find(c => c.id === 1);
      expect(chat?.unreadCount).toBe(0);
    });

    it('should handle marking non-existent chat as read', () => {
      const stateWithChats = {
        ...initialState,
        chats: [...mockChats],
      };

      const newState = chatsReducer(stateWithChats, markChatAsRead(999));

      // Should not throw error, state should remain unchanged
      expect(newState.chats).toEqual(stateWithChats.chats);
    });
  });

  describe('fetchChats async thunk', () => {
    it('should set loading state on pending', () => {
      const action = { type: fetchChats.pending.type };
      const newState = chatsReducer(initialState, action);

      expect(newState.loading).toBe(true);
      expect(newState.error).toBe(null);
    });

    it('should add chats on fulfilled with reset=true', () => {
      const action = {
        type: fetchChats.fulfilled.type,
        payload: { chats: mockChats, reset: true },
      };
      const newState = chatsReducer(initialState, action);

      expect(newState.loading).toBe(false);
      expect(newState.chats).toEqual(mockChats);
      expect(newState.offset).toBe(3);
      expect(newState.hasMore).toBe(false); // Less than 50 chats
    });

    it('should append chats on fulfilled with reset=false', () => {
      const stateWithChats = {
        ...initialState,
        chats: [mockChats[0]],
        offset: 1,
      };

      const action = {
        type: fetchChats.fulfilled.type,
        payload: { chats: [mockChats[1], mockChats[2]], reset: false },
      };
      const newState = chatsReducer(stateWithChats, action);

      expect(newState.loading).toBe(false);
      expect(newState.chats).toHaveLength(3);
      expect(newState.offset).toBe(3);
    });

    it('should set hasMore to true when fetching full page', () => {
      const fullPage = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        title: `Chat ${i + 1}`,
        lastMessageAt: 1000 + i,
        unreadCount: 0,
      }));

      const action = {
        type: fetchChats.fulfilled.type,
        payload: { chats: fullPage, reset: true },
      };
      const newState = chatsReducer(initialState, action);

      expect(newState.hasMore).toBe(true);
    });

    it('should set hasMore to false when fetching partial page', () => {
      const partialPage = [mockChats[0]];

      const action = {
        type: fetchChats.fulfilled.type,
        payload: { chats: partialPage, reset: true },
      };
      const newState = chatsReducer(initialState, action);

      expect(newState.hasMore).toBe(false);
    });

    it('should set error state on rejected', () => {
      const errorMessage = 'Failed to fetch chats';
      const action = {
        type: fetchChats.rejected.type,
        error: { message: errorMessage },
      };
      const newState = chatsReducer(initialState, action);

      expect(newState.loading).toBe(false);
      expect(newState.error).toBe(errorMessage);
    });

    it('should handle rejected with default error message', () => {
      const action = {
        type: fetchChats.rejected.type,
        error: {},
      };
      const newState = chatsReducer(initialState, action);

      expect(newState.loading).toBe(false);
      expect(newState.error).toBe('Failed to fetch chats');
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple operations in sequence', () => {
      let state = chatsReducer(initialState, {
        type: fetchChats.fulfilled.type,
        payload: { chats: mockChats, reset: true },
      });

      state = chatsReducer(state, updateChatLastMessage({ chatId: 1, timestamp: 5000 }));
      state = chatsReducer(state, markChatAsRead(1));

      const chat = state.chats.find(c => c.id === 1);
      expect(chat?.lastMessageAt).toBe(5000);
      expect(chat?.unreadCount).toBe(0);
    });
  });
});
