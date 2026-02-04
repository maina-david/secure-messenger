import { configureStore } from '@reduxjs/toolkit';
import chatsReducer from './chatsSlice';
import messagesReducer from './messagesSlice';
import websocketReducer from './websocketSlice';
import draftsReducer from './draftsSlice';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    chats: chatsReducer,
    messages: messagesReducer,
    websocket: websocketReducer,
    drafts: draftsReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
