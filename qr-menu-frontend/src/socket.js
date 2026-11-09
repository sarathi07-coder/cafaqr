import { io } from 'socket.io-client';

const defaultBackend = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? window.location.origin
  : 'https://cafaqr.vercel.app';

const serverUrl = import.meta.env.VITE_API_URL || defaultBackend;

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

