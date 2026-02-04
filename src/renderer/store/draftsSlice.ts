import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface DraftsState {
  draftsByChatId: Record<number, string>;
}

const initialState: DraftsState = {
  draftsByChatId: {},
};

const draftsSlice = createSlice({
  name: 'drafts',
  initialState,
  reducers: {
    setDraft: (state, action: PayloadAction<{ chatId: number; content: string }>) => {
      const { chatId, content } = action.payload;
      if (content.trim()) {
        state.draftsByChatId[chatId] = content;
      } else {
        delete state.draftsByChatId[chatId];
      }
    },
    clearDraft: (state, action: PayloadAction<number>) => {
      delete state.draftsByChatId[action.payload];
    },
    loadDraft: (state, action: PayloadAction<{ chatId: number; content: string }>) => {
      const { chatId, content } = action.payload;
      if (content) {
        state.draftsByChatId[chatId] = content;
      }
    },
  },
});

export const { setDraft, clearDraft, loadDraft } = draftsSlice.actions;
export default draftsSlice.reducer;
