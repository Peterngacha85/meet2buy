import { io } from 'socket.io-client';

// Dev: same origin (Vite proxies /socket.io). Prod: VITE_API_URL, like the REST API.
const API_URL = import.meta.env.VITE_API_URL || undefined;

/**
 * A fresh Socket.io connection carrying the auth cookie. The server reads the cookie when the
 * connection opens, so each room page opens its own and closes it when you leave.
 */
export function connectSocket() {
  return io(API_URL, { withCredentials: true, transports: ['websocket', 'polling'] });
}
