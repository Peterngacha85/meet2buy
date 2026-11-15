import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSocket } from '../../services/socket.js';

const MAX_MESSAGES = 200;

const initial = {
  status: 'connecting', // connecting | live | reconnecting | closed
  messages: [],
  presence: { viewerCount: 0, shoppers: [], sellerHere: false },
  pinned: null,
  closed: null, // { reason, message }
  isSeller: false,
  canChat: false,
};

/**
 * The room's realtime side (doc 07 §3): presence, chat, pinned product and "room closed".
 * Rejoins by itself after a dropped connection.
 */
export function useRoomSocket(sessionId) {
  const [state, setState] = useState(initial);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return undefined;
    const socket = connectSocket();
    socketRef.current = socket;
    const patch = (p) => setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));

    socket.on('connect', () => {
      socket.emit('room:join', { sessionId }, (res) => {
        if (!res?.ok) patch({ status: 'closed', closed: { reason: 'closed', message: res?.error ?? 'This room is closed' } });
      });
    });
    socket.on('disconnect', () => patch((s) => (s.status === 'closed' ? {} : { status: 'reconnecting' })));
    socket.on('room:state', (st) =>
      patch({
        status: 'live',
        messages: st.recentMessages,
        presence: st.presence,
        pinned: st.session.pinnedProduct,
        isSeller: st.isSeller,
        canChat: st.canChat,
      }),
    );
    socket.on('presence:update', (presence) => patch({ presence }));
    socket.on('chat:message', (m) =>
      patch((s) => (s.messages.some((x) => x.id === m.id) ? {} : { messages: [...s.messages, m].slice(-MAX_MESSAGES) })),
    );
    socket.on('product:pinned', ({ product }) => patch({ pinned: product }));
    socket.on('room:closed', (closed) => patch({ status: 'closed', closed }));

    return () => {
      socket.emit('room:leave', { sessionId });
      socket.disconnect();
      socketRef.current = null;
      // So a "closed" from this session never leaks into the next one.
      setState(initial);
    };
  }, [sessionId]);

  /** Resolves to { ok, error? }. */
  const send = useCallback(
    async (body) => {
      const socket = socketRef.current;
      if (!socket?.connected) return { ok: false, error: 'Reconnecting… try again in a moment' };
      return socket.timeout(8000).emitWithAck('chat:send', { sessionId, body }).catch(() => ({ ok: false, error: 'Message not sent. Try again.' }));
    },
    [sessionId],
  );

  const pin = useCallback(
    async (productId) => {
      const socket = socketRef.current;
      if (!socket?.connected) return { ok: false, error: 'Reconnecting… try again in a moment' };
      return socket.timeout(8000).emitWithAck('product:pin', { sessionId, productId }).catch(() => ({ ok: false, error: 'Could not show that product. Try again.' }));
    },
    [sessionId],
  );

  return { ...state, send, pin };
}
