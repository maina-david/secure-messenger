import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Chat } from '../types';

interface ChatsState {
  chats: Chat[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  offset: number;
}

const initialState: ChatsState = {
  chats: [],
  loading: false,
  error: null,
  hasMore: true,
  offset: 0,
};

const CHATS_PAGE_SIZE = 50;

export const fetchChats = createAsyncThunk(
  'chats/fetchChats',
  async ({ reset = false }: { reset?: boolean } = {}, { getState }) => {
    const state = getState() as { chats: ChatsState };
    const offset = reset ? 0 : state.chats.offset;
    const response = await window.electronAPI.getChats(CHATS_PAGE_SIZE, offset);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch chats');
    }
    return { chats: response.data, reset };
  }
);

const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    updateChatLastMessage: (state, action: PayloadAction<{ chatId: number; timestamp: number }>) => {
      const chat = state.chats.find(c => c.id === action.payload.chatId);
      if (chat) {
        chat.lastMessageAt = action.payload.timestamp;
        chat.unreadCount += 1;
        state.chats.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      }
    },
    markChatAsRead: (state, action: PayloadAction<number>) => {
      const chat = state.chats.find(c => c.id === action.payload);
      if (chat) {
        chat.unreadCount = 0;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChats.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.reset) {
          state.chats = action.payload.chats;
          state.offset = action.payload.chats.length;
        } else {
          state.chats.push(...action.payload.chats);
          state.offset += action.payload.chats.length;
        }
        state.hasMore = action.payload.chats.length === CHATS_PAGE_SIZE;
      })
      .addCase(fetchChats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch chats';
      });
  },
});

export const { updateChatLastMessage, markChatAsRead } = chatsSlice.actions;
export default chatsSlice.reducer;
