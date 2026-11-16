// "Something changed" signals from the server (Socket.io `data:changed`), handed to any page that
// listens. The NotificationCenter owns the socket; pages subscribe here through useFetch({ live }).

const EVENT = 'm2b:data-changed';

/** Called by the socket owner: topics like ['orders'], or ['*'] after a reconnect (catch up on everything). */
export function announceChanged(topics) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: topics }));
}

/** Subscribe; returns an unsubscribe function. */
export function onDataChanged(handler) {
  const listener = (e) => handler(e.detail ?? []);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
