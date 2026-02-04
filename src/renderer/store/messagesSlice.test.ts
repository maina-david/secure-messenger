import messagesReducer, { selectChat, addMessage, fetchMessages, searchMessages } from './messagesSlice';
import { Message } from '../types';

describe('messagesSlice', () => {
  const initialState = {
    messagesByChatId: {},
    loading: false,
    error: null,
    selectedChatId: null,
    hasMore: {},
    offset: {},
  };

  const mockMessages: Message[] = [
    { id: 1, chatId: 1, ts: 1000, sender: 'Alice', body: 'Hello' },
    { id: 2, chatId: 1, ts: 2000, sender: 'Bob', body: 'Hi there' },
    { id: 3, chatId: 1, ts: 3000, sender: 'Alice', body: 'How are you?' },
  ];

  describe('reducers', () => {
    it('should return initial state', () => {
      expect(messagesReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    it('should select chat and initialize offset/hasMore', () => {
      const newState = messagesReducer(initialState, selectChat(1));

      expect(newState.selectedChatId).toBe(1);
      expect(newState.offset[1]).toBe(0);
      expect(newState.hasMore[1]).toBe(true);
    });

    it('should not reinitialize offset/hasMore if chat already selected', () => {
      const stateWithChat = {
        ...initialState,
        selectedChatId: 1,
        offset: { 1: 25 },
        hasMore: { 1: false },
      };

      const newState = messagesReducer(stateWithChat, selectChat(1));

      expect(newState.offset[1]).toBe(25); // Should not reset
      expect(newState.hasMore[1]).toBe(false); // Should not reset
    });

    it('should add message to chat', () => {
      const message: Message = mockMessages[0];
      const newState = messagesReducer(initialState, addMessage(message));

      expect(newState.messagesByChatId[1]).toHaveLength(1);
      expect(newState.messagesByChatId[1][0]).toEqual(message);
    });

    it('should not add duplicate message', () => {
      const message: Message = mockMessages[0];
      let state = messagesReducer(initialState, addMessage(message));
      state = messagesReducer(state, addMessage(message));

      expect(state.messagesByChatId[1]).toHaveLength(1);
    });

    it('should keep messages sorted by timestamp', () => {
      let state = messagesReducer(initialState, addMessage(mockMessages[2]));
      state = messagesReducer(state, addMessage(mockMessages[0]));
      state = messagesReducer(state, addMessage(mockMessages[1]));

      const messages = state.messagesByChatId[1];
      expect(messages[0].ts).toBe(1000);
      expect(messages[1].ts).toBe(2000);
      expect(messages[2].ts).toBe(3000);
    });

    it('should handle messages for different chats', () => {
      const message1: Message = { id: 1, chatId: 1, ts: 1000, sender: 'Alice', body: 'Chat 1' };
      const message2: Message = { id: 2, chatId: 2, ts: 2000, sender: 'Bob', body: 'Chat 2' };

      let state = messagesReducer(initialState, addMessage(message1));
      state = messagesReducer(state, addMessage(message2));

      expect(state.messagesByChatId[1]).toHaveLength(1);
      expect(state.messagesByChatId[2]).toHaveLength(1);
      expect(state.messagesByChatId[1][0].body).toBe('Chat 1');
      expect(state.messagesByChatId[2][0].body).toBe('Chat 2');
    });
  });

  describe('fetchMessages async thunk', () => {
    it('should set loading state on pending', () => {
      const action = { type: fetchMessages.pending.type };
      const newState = messagesReducer(initialState, action);

      expect(newState.loading).toBe(true);
      expect(newState.error).toBe(null);
    });

    it('should set messages on fulfilled with reset=true', () => {
      const action = {
        type: fetchMessages.fulfilled.type,
        payload: { chatId: 1, messages: mockMessages, reset: true },
      };
      const newState = messagesReducer(initialState, action);

      expect(newState.loading).toBe(false);
      expect(newState.messagesByChatId[1]).toEqual(mockMessages);
      expect(newState.offset[1]).toBe(3);
      expect(newState.hasMore[1]).toBe(false); // Less than 50 messages
    });

    it('should prepend messages on fulfilled with reset=false', () => {
      const stateWithMessages = {
        ...initialState,
        messagesByChatId: { 1: [mockMessages[2]] },
        offset: { 1: 1 },
      };

      const olderMessages = [mockMessages[0], mockMessages[1]];
      const action = {
        type: fetchMessages.fulfilled.type,
        payload: { chatId: 1, messages: olderMessages, reset: false },
      };
      const newState = messagesReducer(stateWithMessages, action);

      expect(newState.messagesByChatId[1]).toHaveLength(3);
      expect(newState.messagesByChatId[1][0]).toEqual(mockMessages[0]);
      expect(newState.messagesByChatId[1][2]).toEqual(mockMessages[2]);
      expect(newState.offset[1]).toBe(3);
    });

    it('should set hasMore to true when fetching full page', () => {
      const fullPage = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        chatId: 1,
        ts: 1000 + i,
        sender: 'Alice',
        body: `Message ${i + 1}`,
      }));

      const action = {
        type: fetchMessages.fulfilled.type,
        payload: { chatId: 1, messages: fullPage, reset: true },
      };
      const newState = messagesReducer(initialState, action);

      expect(newState.hasMore[1]).toBe(true);
    });

    it('should set hasMore to false when fetching partial page', () => {
      const action = {
        type: fetchMessages.fulfilled.type,
        payload: { chatId: 1, messages: [mockMessages[0]], reset: true },
      };
      const newState = messagesReducer(initialState, action);

      expect(newState.hasMore[1]).toBe(false);
    });

    it('should set error state on rejected', () => {
      const errorMessage = 'Failed to fetch messages';
      const action = {
        type: fetchMessages.rejected.type,
        error: { message: errorMessage },
      };
      const newState = messagesReducer(initialState, action);

      expect(newState.loading).toBe(false);
      expect(newState.error).toBe(errorMessage);
    });
  });

  describe('searchMessages async thunk', () => {
    it('should replace messages with search results', () => {
      const stateWithMessages = {
        ...initialState,
        messagesByChatId: { 1: mockMessages },
      };

      const searchResults = [mockMessages[0], mockMessages[2]];
      const action = {
        type: searchMessages.fulfilled.type,
        payload: { chatId: 1, messages: searchResults },
      };
      const newState = messagesReducer(stateWithMessages, action);

      expect(newState.messagesByChatId[1]).toEqual(searchResults);
    });

    it('should handle empty search results', () => {
      const stateWithMessages = {
        ...initialState,
        messagesByChatId: { 1: mockMessages },
      };

      const action = {
        type: searchMessages.fulfilled.type,
        payload: { chatId: 1, messages: [] },
      };
      const newState = messagesReducer(stateWithMessages, action);

      expect(newState.messagesByChatId[1]).toEqual([]);
    });
  });

  describe('integration scenarios', () => {
    it('should handle selecting chat and adding messages', () => {
      let state = messagesReducer(initialState, selectChat(1));
      state = messagesReducer(state, addMessage(mockMessages[0]));
      state = messagesReducer(state, addMessage(mockMessages[1]));

      expect(state.selectedChatId).toBe(1);
      expect(state.messagesByChatId[1]).toHaveLength(2);
    });

    it('should handle fetching messages then adding new ones', () => {
      let state = messagesReducer(initialState, {
        type: fetchMessages.fulfilled.type,
        payload: { chatId: 1, messages: [mockMessages[0], mockMessages[1]], reset: true },
      });

      state = messagesReducer(state, addMessage(mockMessages[2]));

      expect(state.messagesByChatId[1]).toHaveLength(3);
      expect(state.messagesByChatId[1][2].id).toBe(3);
    });

    it('should maintain state for multiple chats', () => {
      let state = messagesReducer(initialState, selectChat(1));
      state = messagesReducer(state, addMessage({ ...mockMessages[0], chatId: 1 }));
      state = messagesReducer(state, selectChat(2));
      state = messagesReducer(state, addMessage({ ...mockMessages[1], chatId: 2 }));

      expect(state.messagesByChatId[1]).toHaveLength(1);
      expect(state.messagesByChatId[2]).toHaveLength(1);
      expect(state.selectedChatId).toBe(2);
    });
  });
});
