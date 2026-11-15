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
  // Queue & counter (doc 07 §4)
  counter: null, // { entryId, buyer: { id, name }, product, calledAt, timeLimitMinutes }
  queueLength: 0, // buyers waiting
  queue: [], // seller only: active entries, oldest first
  myQueue: { status: null }, // buyer: { status: 'waiting', position, total, product } | { status: 'at_counter' } | { status: null, notice? }
  turn: null, // buyer: { granted, timeLimitMinutes, at } — set when called to the counter
};

/**
 * The room's realtime side (doc 07 §3): presence, chat, pinned product, queue, counter and "room closed".
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
    const mine = (payload) => payload?.sessionId === sessionId;

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
        counter: st.counter,
        queueLength: st.queueLength ?? 0,
        queue: st.queue ?? [],
        myQueue: st.myQueue ?? { status: null },
      }),
    );
    socket.on('presence:update', (presence) => patch({ presence }));
    socket.on('chat:message', (m) =>
      patch((s) => (s.messages.some((x) => x.id === m.id) ? {} : { messages: [...s.messages, m].slice(-MAX_MESSAGES) })),
    );
    socket.on('product:pinned', ({ product }) => patch({ pinned: product }));
    socket.on('room:closed', (closed) => patch({ status: 'closed', closed }));

    socket.on('queue:length', (p) => mine(p) && patch({ queueLength: p.total }));
    socket.on('queue:updated', (p) => mine(p) && patch({ queue: p.entries }));
    socket.on('queue:position', (p) => {
      if (!mine(p)) return;
      if (p.status === 'waiting') patch({ myQueue: { status: 'waiting', position: p.position, total: p.total, product: p.product } });
      else patch((s) => (s.myQueue.status === 'at_counter' ? {} : { myQueue: { status: null, notice: p.status } }));
    });
    socket.on('counter:changed', (p) => mine(p) && patch({ counter: p.counter }));
    socket.on('counter:yourTurn', (p) =>
      mine(p) && patch({ myQueue: { status: 'at_counter', product: p.product }, turn: { granted: p.granted, timeLimitMinutes: p.timeLimitMinutes, at: Date.now() } }),
    );
    socket.on('counter:ended', (p) => mine(p) && patch({ myQueue: { status: null, notice: 'served' }, turn: null }));

    return () => {
      socket.emit('room:leave', { sessionId });
      socket.disconnect();
      socketRef.current = null;
      // So a "closed" from this session never leaks into the next one.
      setState(initial);
    };
  }, [sessionId]);

  /** Emit with an ack. Resolves to { ok, error?, ... } and never rejects. */
  const emit = useCallback(
    async (event, payload = {}, failMessage = 'Something went wrong. Try again.') => {
      const socket = socketRef.current;
      if (!socket?.connected) return { ok: false, error: 'Reconnecting… try again in a moment' };
      return socket
        .timeout(8000)
        .emitWithAck(event, { sessionId, ...payload })
        .catch(() => ({ ok: false, error: failMessage }));
    },
    [sessionId],
  );

  const send = useCallback((body) => emit('chat:send', { body }, 'Message not sent. Try again.'), [emit]);
  const pin = useCallback((productId) => emit('product:pin', { productId }, 'Could not show that product. Try again.'), [emit]);

  const joinQueue = useCallback(
    async (productId = null, note = '') => {
      const res = await emit('queue:join', { productId, note });
      if (res.ok) setState((s) => ({ ...s, myQueue: res.mine }));
      return res;
    },
    [emit],
  );
  const leaveQueue = useCallback(async () => {
    const res = await emit('queue:leave');
    if (res.ok) setState((s) => ({ ...s, myQueue: { status: null }, turn: null }));
    return res;
  }, [emit]);
  const callNext = useCallback(() => emit('queue:callNext'), [emit]);
  const endCounter = useCallback(() => emit('queue:endCounter'), [emit]);
  const skip = useCallback((entryId) => emit('queue:skip', { entryId }), [emit]);

  return { ...state, send, pin, joinQueue, leaveQueue, callNext, endCounter, skip };
}
