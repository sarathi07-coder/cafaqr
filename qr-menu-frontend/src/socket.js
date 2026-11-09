import { io } from 'socket.io-client';

const serverUrl = import.meta.env.VITE_API_URL || window.location.origin;

export const socket = io(serverUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
});

export function getSocket() {
  return socket;
}

