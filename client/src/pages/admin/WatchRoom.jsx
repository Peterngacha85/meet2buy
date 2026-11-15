import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, EyeOff, Loader2, Square, Volume2 } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { ProductImage } from '../../features/mall/ProductCard.jsx';
import { ChatPanel } from '../../features/room/ChatPanel.jsx';
import { TrackAudio, TrackVideo } from '../../features/room/Media.jsx';
import { CounterTile } from '../../features/room/Queue.jsx';
import { LiveBadge, PinnedProduct, PresenceBar } from '../../features/room/RoomBits.jsx';
import { clock, useElapsedSeconds } from '../../features/room/useElapsed.js';
import { useLiveKit } from '../../features/room/useLiveKit.js';
import { useRoomSocket } from '../../features/room/useRoomSocket.js';
import { useFetch } from '../../hooks/useFetch.js';
import { api } from '../../services/api.js';
import { kes } from '../../utils/format.js';
import { CloseRoomDialog } from './LiveRooms.jsx';

// Admin review of one live room: video, chat, queue and counter — invisible to everyone in the room.
export function AdminWatchRoom() {
  const { sessionId } = useParams();
  const watch = useFetch(() => api.post(`/admin/rooms/${sessionId}/watch`), [sessionId]);
  const lk = useLiveKit({ url: watch.data?.livekit.url, token: watch.data?.livekit.token });
  const rt = useRoomSocket(watch.data ? sessionId : null, { observe: true });
  const [closing, setClosing] = useState(false);
  const elapsed = useElapsedSeconds(watch.data?.session.startedAt ?? null);

  if (watch.loading) return <Spinner label="Opening the room…" />;
  const closed = watch.error?.status === 404 || rt.status === 'closed';
  if (closed) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">This room is closed</h1>
        <p className="mt-2 text-muted">{rt.closed?.message ?? 'The session has ended.'}</p>
        <Button to="/admin/live-rooms" variant="outline" className="mt-6">
          Back to live rooms
        </Button>
      </div>
    );
  }
  if (watch.error) return <p className="text-danger">{watch.error.message}</p>;

  const { store, products } = watch.data;
  const current = rt.queue.find((e) => e.status === 'at_counter');
  const waiting = rt.queue.filter((e) => e.status === 'waiting');

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/live-rooms" className="inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
            <ArrowLeft className="size-4" aria-hidden /> Live rooms
          </Link>
          <h1 className="text-[26px] font-bold">{store.name}</h1>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted">
            <EyeOff className="size-4" aria-hidden /> You're watching invisibly — the seller and shoppers can't see or hear you.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button to={`/shop/${store.slug}`} variant="ghost" size="sm" target="_blank">
            Shop page
          </Button>
          <Button variant="danger" size="sm" onClick={() => setClosing(true)}>
            <Square className="size-4" aria-hidden /> Close room
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-card bg-navy-dark">
            {lk.seller.video ? (
              <TrackVideo track={lk.seller.video} className="absolute inset-0 size-full object-contain" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-center text-white/80">
                <div>
                  {lk.connection === 'connecting' && <Loader2 className="mx-auto size-8 animate-spin text-orange" aria-hidden />}
                  <p className="mt-3 font-display text-lg font-bold text-white">
                    {lk.connection === 'connecting' ? 'Connecting…' : rt.presence.sellerHere ? 'Seller camera is off' : 'Seller disconnected'}
                  </p>
                  {lk.error && <p className="mt-1 text-sm">{lk.error}</p>}
                </div>
              </div>
            )}
            {lk.seller.audio && <TrackAudio track={lk.seller.audio} />}
            {lk.counter?.audio && <TrackAudio track={lk.counter.audio} />}
            {lk.counter?.video && (
              <CounterTile label={lk.counter.name}>
                <TrackVideo track={lk.counter.video} className="size-full object-cover" />
              </CounterTile>
            )}
            <div className="absolute left-3 top-3">
              <LiveBadge viewers={rt.presence.viewerCount} />
            </div>
            <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">{clock(elapsed)}</span>
            {!lk.canPlayAudio && (
              <button
                type="button"
                onClick={lk.startAudio}
                className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-orange px-5 py-3 font-semibold text-navy shadow-lg"
              >
                <Volume2 className="size-5" aria-hidden /> Tap to listen
              </button>
            )}
            <PinnedProduct product={rt.pinned} className="absolute bottom-3 left-3 w-[min(22rem,calc(100%-1.5rem))]" />
          </div>

          <PresenceBar presence={rt.presence} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-4">
              <h2 className="font-bold">Counter</h2>
              {current ? (
                <div className="mt-2 text-sm">
                  <p className="font-semibold text-ink">{current.buyer.name}</p>
                  {current.product && <p className="text-muted">Wants to see: {current.product.name}</p>}
                  {current.note && <p className="text-muted">“{current.note}”</p>}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">Nobody at the counter.</p>
              )}
              <h3 className="mt-4 text-sm font-semibold text-navy">Waiting ({waiting.length})</h3>
              <ol className="mt-1 space-y-1 text-sm">
                {waiting.map((e, i) => (
                  <li key={e.id} className="text-ink">
                    {i + 1}. {e.buyer.name}
                    {e.product && <span className="text-muted"> · {e.product.name}</span>}
                  </li>
                ))}
              </ol>
            </Card>
            <Card className="p-4">
              <h2 className="font-bold">Shelf ({products.length})</h2>
              <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <ProductImage src={p.images[0]} alt="" w={80} className="size-9 shrink-0 rounded-md" />
                    <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                    <span className="text-muted">{kes(p.price)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <ChatPanel
          messages={rt.messages}
          canChat={false}
          onSend={async () => ({ ok: false })}
          readOnly="Read-only: you're watching as Meet2buy."
          className="h-[60dvh] overflow-hidden rounded-card border border-line lg:sticky lg:top-8 lg:h-[calc(100dvh-8rem)]"
        />
      </div>

      <CloseRoomDialog room={closing ? { id: sessionId, store } : null} onClose={() => setClosing(false)} />
    </div>
  );
}
