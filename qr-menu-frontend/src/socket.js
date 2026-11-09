import { io } from 'socket.io-client';

// Lazy socket: only connect when first accessed
let _socket = null;

export function getSocket() {
  if (!_socket) {
    const serverUrl = import.meta.env.VITE_API_URL || window.location.origin;
    _socket = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'], // Prefer WebSocket for speed
    });
  }
  return _socket;
}

// Keep backward-compatible named export (connects on first import that accesses it)
// Using a getter so pages that don't touch `socket` don't trigger connection
export const socket = new Proxy({}, {
  get(_, prop) {
    return getSocket()[prop];
  }
});

