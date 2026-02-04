import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ConnectionStatus from './ConnectionStatus';
import websocketReducer from '../store/websocketSlice';

const createMockStore = (status: string, lastPingTime?: number) => {
  return configureStore({
    reducer: {
      websocket: () => ({ status, lastPingTime }),
    },
  });
};

describe('ConnectionStatus', () => {
  it('should render connected status', () => {
    const store = createMockStore('connected', Date.now());
    render(
      <Provider store={store}>
        <ConnectionStatus />
      </Provider>
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('should render connecting status', () => {
    const store = createMockStore('connecting');
    render(
      <Provider store={store}>
        <ConnectionStatus />
      </Provider>
    );

    expect(screen.getByText('Connecting')).toBeInTheDocument();
  });

  it('should render reconnecting status', () => {
    const store = createMockStore('reconnecting');
    render(
      <Provider store={store}>
        <ConnectionStatus />
      </Provider>
    );

    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
  });

  it('should render offline status', () => {
    const store = createMockStore('offline');
    render(
      <Provider store={store}>
        <ConnectionStatus />
      </Provider>
    );

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('should show last ping time when connected', () => {
    const lastPingTime = Date.now();
    const store = createMockStore('connected', lastPingTime);
    const { container } = render(
      <Provider store={store}>
        <ConnectionStatus />
      </Provider>
    );

    // Check that time is displayed (format: HH:MM:SS)
    expect(container.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('should not show last ping time when not connected', () => {
    const store = createMockStore('connecting');
    const { container } = render(
      <Provider store={store}>
        <ConnectionStatus />
      </Provider>
    );

    // Should not display time format when not connected
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('should handle unknown status', () => {
    const store = createMockStore('unknown');
    render(
      <Provider store={store}>
        <ConnectionStatus />
      </Provider>
    );

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
