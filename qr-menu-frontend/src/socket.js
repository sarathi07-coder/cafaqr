import { io } from 'socket.io-client';

// Connect to backend websocket
export const socket = io(window.location.origin, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

