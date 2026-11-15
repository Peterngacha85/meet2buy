import { useEffect, useState } from 'react';
import { Clock, Eye, Hand, PhoneCall, Radio, ShoppingBag, Square } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Textarea } from '../../components/ui/Field.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { SignBoard } from '../../features/mall/ShopSign.jsx';
import { clock, useElapsedSeconds } from '../../features/room/useElapsed.js';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { kes } from '../../utils/format.js';

const REFRESH_MS = 10_000;

function LiveFor({ since }) {
  return <>{clock(useElapsedSeconds(since))}</>;
}

/** Close a room with a reason the seller will see. */
export function CloseRoomDialog({ room, onClose, onClosed }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Reset only when a different room is opened (the Watch page re-renders every second for its timer).
  const roomId = room?.id ?? null;
  useEffect(() => {
    setReason('');
    setError('');
  }, [roomId]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await unwrap(api.post(`/admin/rooms/${room.id}/close`, { reason: reason.trim() || undefined }));
      onClosed?.();
      onClose();
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(room)} onClose={onClose} title={`Close ${room?.store?.name ?? 'this'} room?`}>
      <form onSubmit={submit}>
        <p className="text-sm text-muted">
          Everyone watching sees “This room was closed by Meet2buy” and the seller is notified. The seller can go live again unless you
          also suspend the shop in Sellers.
        </p>
        <Textarea className="mt-4" label="Reason (sent to the seller)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} rows={2} placeholder="e.g. Showing goods not allowed on Meet2buy" />
        <FormError message={error} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Keep open
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            Close room
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// Admin: every live room right now (doc 02 §3), refreshed every 10 seconds. Watch invisibly or close.
export function AdminLiveRooms() {
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/rooms/live'));
  const [closing, setClosing] = useState(null);

  useEffect(() => {
    const t = setInterval(reload, REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);

  const rooms = data?.rooms ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[28px] font-bold">Live rooms</h1>
      <p className="mt-1 text-muted">Shops live right now. Watch any room without being seen, or close it if something is wrong.</p>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <p className="mt-6 text-danger">{error.message}</p>
      ) : !rooms.length ? (
        <Card className="mt-6 px-6 py-12 text-center text-muted">
          <Radio className="mx-auto size-7 text-navy" aria-hidden />
          <p className="mt-3 font-semibold text-ink">No shop is live right now</p>
          <p className="mt-1 text-sm">This page updates by itself.</p>
        </Card>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {rooms.map((r) => (
            <li key={r.id}>
              <Card className="overflow-hidden">
                {r.store && <SignBoard store={{ ...r.store, isLive: true }} />}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-lg font-bold text-navy">{r.store?.name}</p>
                    <span className="inline-flex items-center gap-1 text-sm text-muted">
                      <Clock className="size-4" aria-hidden /> <LiveFor since={r.startedAt} />
                    </span>
                  </div>
                  {!r.sellerHere && <p className="mt-1 text-sm font-medium text-danger">Seller disconnected — the room closes after 2 minutes</p>}
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div className="flex items-center gap-1.5 text-muted">
                      <Eye className="size-4" aria-hidden /> <dd className="font-semibold text-ink">{r.viewers}</dd> watching
                      <span className="text-xs">(peak {r.peakViewers})</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted">
                      <Hand className="size-4" aria-hidden /> <dd className="font-semibold text-ink">{r.waiting}</dd> in queue
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5 text-muted">
                      <PhoneCall className="size-4" aria-hidden /> Counter: <dd className="font-medium text-ink">{r.counterBuyer ?? 'nobody'}</dd>
                    </div>
                    {r.pinned && (
                      <div className="col-span-2 truncate text-muted">
                        Showing: <span className="font-medium text-ink">{r.pinned}</span>
                      </div>
                    )}
                    <div className="col-span-2 flex items-center gap-1.5 text-muted">
                      <ShoppingBag className="size-4" aria-hidden /> Sales this session: <dd className="font-semibold text-ink">{kes(r.totalSales)}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <Button to={`/admin/live-rooms/${r.id}`} variant="primary" size="sm" className="flex-1">
                      <Eye className="size-4" aria-hidden /> Watch
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setClosing(r)}>
                      <Square className="size-4" aria-hidden /> Close
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CloseRoomDialog room={closing} onClose={() => setClosing(null)} onClosed={reload} />
    </div>
  );
}
