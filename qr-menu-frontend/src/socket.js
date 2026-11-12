import { io } from 'socket.io-client';

const defaultBackend = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? window.location.origin
  : 'https://cafaqr-api.p7404467.workers.dev';

const serverUrl = (import.meta.env.VITE_API_URL || defaultBackend).replace(/\/+$/, '');
const isCloudflareWorkers = serverUrl.includes('workers.dev');

// Cloudflare Workers uses REST polling instead of Socket.IO; avoid spurious /socket.io 404 requests.
const noopSocket = {
  connected: false,
  on() {},
  off() {},
  once() {},
  emit() {},
  connect() {},
  disconnect() {},
};

export const socket = isCloudflareWorkers
  ? noopSocket
  : io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

export function getSocket() {
  return socket;
}
