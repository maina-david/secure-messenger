import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

interface WebSocketState {
  status: ConnectionStatus;
  lastPingTime: number | null;
  reconnectAttempts: number;
}

const initialState: WebSocketState = {
  status: 'offline',
  lastPingTime: null,
  reconnectAttempts: 0,
};

const websocketSlice = createSlice({
  name: 'websocket',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.status = action.payload;
      if (action.payload === 'connected') {
        state.reconnectAttempts = 0;
      }
    },
    updateLastPing: (state) => {
      state.lastPingTime = Date.now();
    },
    incrementReconnectAttempts: (state) => {
      state.reconnectAttempts += 1;
    },
    resetReconnectAttempts: (state) => {
      state.reconnectAttempts = 0;
    },
  },
});

export const {
  setConnectionStatus,
  updateLastPing,
  incrementReconnectAttempts,
  resetReconnectAttempts,
} = websocketSlice.actions;

export default websocketSlice.reducer;
