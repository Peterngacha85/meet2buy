import { useEffect } from 'react';
import { Link } from 'react-router';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { connectSocket } from '../../services/socket.js';
import { chime, systemNotify, useNotifyStore } from '../../store/notifyStore.js';

const AUTO_HIDE_MS = 9000;

/**
 * Live notifications for the logged-in user (Socket.io "notify"): a toast, a chime, a system
 * notification when the tab is hidden, and fresh badge counts. Mounted once in each layout.
 */
export function NotificationCenter() {
  const { user } = useAuth();
  const { toasts, push, dismiss, refreshBadges, clear } = useNotifyStore();

  useEffect(() => {
    if (!user) {
      clear();
      return undefined;
    }
    refreshBadges();
    const socket = connectSocket();
    socket.on('connect', () => {
      refreshBadges(); // catch up after a reconnect
      socket.emit('notify:sync'); // demo invites sent while we were away
    });
    socket.on('notify', (n) => {
      if (push(n) === null) return; // already showing, or dismissed earlier
      chime();
      systemNotify(n.title, n.body);
      refreshBadges();
    });
    return () => socket.disconnect();
  }, [user, push, refreshBadges, clear]);

  return <Toasts toasts={toasts} dismiss={dismiss} />;
}

export function Toasts({ toasts, dismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (toast.sticky) return undefined;
    const timer = setTimeout(onClose, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [toast.sticky, onClose]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-card border bg-white p-3.5 shadow-[0_16px_40px_-16px_rgb(11_31_92/0.45)] ${
        toast.sticky ? 'border-orange ring-2 ring-orange/30' : 'border-line'
      }`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange text-navy">
        <Bell className="size-4.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-navy">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-sm text-ink">{toast.body}</p>}
        {toast.link && (
          <Link
            to={toast.link}
            onClick={onClose}
            className="mt-2 inline-flex rounded-btn bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-dark"
          >
            {toast.action ?? 'View'}
          </Link>
        )}
      </div>
      <button onClick={onClose} className="-m-1 rounded-btn p-1 text-muted hover:bg-bg-soft hover:text-navy" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}
