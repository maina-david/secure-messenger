import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Message } from '../types';

interface MessagesState {
  messagesByChatId: Record<number, Message[]>;
  loading: boolean;
  error: string | null;
  selectedChatId: number | null;
  hasMore: Record<number, boolean>;
  offset: Record<number, number>;
}

const initialState: MessagesState = {
  messagesByChatId: {},
  loading: false,
  error: null,
  selectedChatId: null,
  hasMore: {},
  offset: {},
};

const MESSAGES_PAGE_SIZE = 50;

export const fetchMessages = createAsyncThunk(
  'messages/fetchMessages',
  async ({ chatId, reset = false }: { chatId: number; reset?: boolean }, { getState }) => {
    const state = getState() as { messages: MessagesState };
    const offset = reset ? 0 : (state.messages.offset[chatId] || 0);
    const response = await window.electronAPI.getMessages(chatId, MESSAGES_PAGE_SIZE, offset);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch messages');
    }
    return { chatId, messages: response.data, reset };
  }
);

export const searchMessages = createAsyncThunk(
  'messages/searchMessages',
  async ({ chatId, query }: { chatId: number; query: string }) => {
    const response = await window.electronAPI.searchMessages(chatId, query, 50);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to search messages');
    }
    return { chatId, messages: response.data };
  }
);

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    selectChat: (state, action: PayloadAction<number>) => {
      state.selectedChatId = action.payload;
      if (!(action.payload in state.offset)) {
        state.offset[action.payload] = 0;
        state.hasMore[action.payload] = true;
      }
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      const { chatId } = action.payload;
      if (!state.messagesByChatId[chatId]) {
        state.messagesByChatId[chatId] = [];
      }
      const exists = state.messagesByChatId[chatId].some(m => m.id === action.payload.id);
      if (!exists) {
        state.messagesByChatId[chatId].push(action.payload);
        state.messagesByChatId[chatId].sort((a, b) => a.ts - b.ts);
      }
    },
    editMessage: (state, action: PayloadAction<{ messageId: number; newBody: string; editedAt: number }>) => {
      const { messageId, newBody, editedAt } = action.payload;
      for (const chatId in state.messagesByChatId) {
        const messages = state.messagesByChatId[chatId];
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          messages[messageIndex] = {
            ...messages[messageIndex],
            body: newBody,
            editedAt,
          };
          break;
        }
      }
    },
    deleteMessage: (state, action: PayloadAction<number>) => {
      const messageId = action.payload;
      for (const chatId in state.messagesByChatId) {
        const messages = state.messagesByChatId[chatId];
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          messages[messageIndex] = {
            ...messages[messageIndex],
            isDeleted: 1,
            deletedAt: Date.now(),
          };
          break;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.loading = false;
        const { chatId, messages, reset } = action.payload;

        if (reset) {
          state.messagesByChatId[chatId] = messages;
          state.offset[chatId] = messages.length;
        } else {
          if (!state.messagesByChatId[chatId]) {
            state.messagesByChatId[chatId] = [];
          }
          // Prepend older messages (since we're loading backward in time)
          state.messagesByChatId[chatId] = [...messages, ...state.messagesByChatId[chatId]];
          state.offset[chatId] = (state.offset[chatId] || 0) + messages.length;
        }

        state.hasMore[chatId] = messages.length === MESSAGES_PAGE_SIZE;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch messages';
      })
      .addCase(searchMessages.fulfilled, (state, action) => {
        // For search results, we replace the messages temporarily
        const { chatId, messages } = action.payload;
        state.messagesByChatId[chatId] = messages;
      });
  },
});

export const { selectChat, addMessage, editMessage, deleteMessage } = messagesSlice.actions;
export default messagesSlice.reducer;
