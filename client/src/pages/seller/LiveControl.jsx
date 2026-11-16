import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Camera, CameraOff, Clock, ExternalLink, Loader2, Mic, MicOff, Radio, Square, Video, WifiOff } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { ProductImage } from '../../features/mall/ProductCard.jsx';
import { ChatPanel } from '../../features/room/ChatPanel.jsx';
import { TrackAudio, TrackVideo } from '../../features/room/Media.jsx';
import { CounterTile, SellerQueueCard } from '../../features/room/Queue.jsx';
import { clock, useElapsedSeconds } from '../../features/room/useElapsed.js';
import { LiveBadge, PinnedProduct, PresenceBar } from '../../features/room/RoomBits.jsx';
import { mediaErrorMessage, startCameraAndMic, useLiveKit } from '../../features/room/useLiveKit.js';
import { useRoomSocket } from '../../features/room/useRoomSocket.js';
import { useMyStore } from '../../features/seller/useMyStore.js';
import { InviteButton } from '../../features/seller/InviteButton.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { kes } from '../../utils/format.js';

const useElapsed = (since) => clock(useElapsedSeconds(since));

// Seller's live control (doc 07): camera preview → Go live → show products, chat, end.
export function LiveControl() {
  const { store, setStore } = useMyStore();
  const mine = useFetch(() => api.get('/rooms/mine'));
  const requests = useFetch(() => api.get('/stores/mine/presentation-requests?status=active'), [], { live: ['requests'] });
  const [params, setParams] = useSearchParams();
  const inviteId = params.get('invite'); // from "Go live & invite" on Demo requests

  const [live, setLive] = useState(null); // { session, livekit }
  const [tracks, setTracks] = useState(null); // local camera + mic tracks
  const [camBusy, setCamBusy] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [starting, setStarting] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [pinError, setPinError] = useState('');

  // Pick up a session that is already running (page reload, came back from another page).
  useEffect(() => {
    if (mine.data?.session) setLive({ session: mine.data.session, livekit: mine.data.livekit });
  }, [mine.data]);

  const startCamera = useCallback(async () => {
    setCamBusy(true);
    setError('');
    try {
      const t = await startCameraAndMic();
      setTracks(t);
      setMicOn(true);
      setCamOn(true);
    } catch (err) {
      setError(mediaErrorMessage(err));
    } finally {
      setCamBusy(false);
    }
  }, []);

  // Already live after a reload: turn the camera back on straight away.
  useEffect(() => {
    if (live && !tracks && !camBusy && !error) startCamera();
  }, [live, tracks, camBusy, error, startCamera]);

  // Stop the camera light when leaving the page.
  useEffect(() => () => tracks?.forEach((t) => t.stop()), [tracks]);

  const lk = useLiveKit({
    url: live && tracks ? live.livekit.url : null,
    token: live && tracks ? live.livekit.token : null,
    publish: tracks,
  });
  const rt = useRoomSocket(live?.session.id);
  const elapsed = useElapsed(live?.session.startedAt);

  // Room closed from elsewhere (seller gone too long, suspended): back to the preview.
  useEffect(() => {
    if (rt.status === 'closed' && live) {
      setNotice(rt.closed?.message ?? 'Your room has closed.');
      setLive(null);
      setStore({ ...store, isLive: false });
    }
  }, [rt.status, rt.closed, live, store, setStore]);

  // Live now and an invite is waiting to be sent: send it exactly once.
  const sentInvite = useRef(null);
  const reloadRequests = requests.reload;
  useEffect(() => {
    if (!inviteId || !live || rt.status !== 'live' || sentInvite.current === inviteId) return;
    sentInvite.current = inviteId;
    setParams((p) => {
      p.delete('invite');
      return p;
    }, { replace: true });
    unwrap(api.post(`/stores/mine/presentation-requests/${inviteId}/invite`))
      .then(() => {
        setNotice("Invite sent. The shopper gets a pop-up to join your room — call them to the counter when they're in the queue.");
        reloadRequests();
      })
      .catch((err) => setError(apiError(err).message));
  }, [inviteId, live, rt.status, setParams, reloadRequests]);

  if (!store || mine.loading) return <Spinner />;

  const videoTrack = tracks?.find((t) => t.kind === 'video');
  const audioTrack = tracks?.find((t) => t.kind === 'audio');
  const products = mine.data?.products ?? [];
  const openRequests = requests.data?.openCount ?? 0;

  const toggle = async (track, on, set) => {
    if (!track) return;
    if (on) await track.mute();
    else await track.unmute();
    set(!on);
  };

  async function goLive() {
    setStarting(true);
    setError('');
    setNotice('');
    try {
      const data = await unwrap(api.post('/rooms/start'));
      setLive(data);
      setStore({ ...store, isLive: true });
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setStarting(false);
    }
  }

  async function endLive() {
    setEnding(true);
    try {
      await api.post('/rooms/end');
    } catch (err) {
      // 409 = already ended (e.g. closed from another tab): fine.
      if (apiError(err).status !== 409) {
        setError(apiError(err).message);
        setEnding(false);
        return;
      }
    }
    setLive(null);
    setStore({ ...store, isLive: false });
    setConfirmEnd(false);
    setEnding(false);
    setNotice('Your room is closed. Shoppers can still browse your line-up and ask for demos.');
    requests.reload();
  }

  async function pin(productId) {
    setPinError('');
    const res = await rt.pin(productId);
    if (!res?.ok) setPinError(res?.error ?? 'Could not show that product');
  }

  if (store.status !== 'approved') {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[28px] font-bold">Live control</h1>
        <Card className="mt-6 p-6">
          <h2 className="text-lg font-bold">Your shop opens for live demos once it's approved</h2>
          <p className="mt-1 text-sm text-muted">
            Meet2buy is checking your shop. Meanwhile, add your logo and products so your shelf is ready on your first live.
          </p>
          <Button to="/seller" variant="outline" size="sm" className="mt-4">
            Back to overview
          </Button>
        </Card>
      </div>
    );
  }

  const isLive = Boolean(live);
  const reconnecting = isLive && (lk.connection === 'reconnecting' || rt.status === 'reconnecting');

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Live control</h1>
          <p className="text-muted">{isLive ? 'Your shop is open. Shoppers can see and hear you.' : 'Check your camera, then open your shop.'}</p>
        </div>
        {isLive && (
          <Button to={`/shop/${store.slug}`} variant="ghost" size="sm" target="_blank">
            <ExternalLink className="size-4" aria-hidden /> Shop page
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <FormError message={error || lk.error} />
          {inviteId && !live && (
            <p role="status" className="rounded-btn border border-orange/40 bg-orange-soft px-3.5 py-2.5 text-sm text-ink">
              Turn on your camera and press <strong>Go live</strong>. Your demo invite is sent to the shopper as soon as you're live.
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-btn border border-navy/15 bg-navy-soft px-3.5 py-2.5 text-sm text-navy">
              {notice}
            </p>
          )}

          {/* Camera */}
          <Card className="overflow-hidden">
            <div className="relative aspect-video bg-navy-dark">
              {videoTrack && camOn ? (
                <TrackVideo track={videoTrack} mirror className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center px-6 text-center text-white/80">
                  <div>
                    {camBusy ? <Loader2 className="mx-auto size-8 animate-spin text-orange" /> : <Video className="mx-auto size-8 text-orange" />}
                    <p className="mt-3 font-display text-lg font-bold text-white">
                      {camBusy ? 'Starting your camera…' : tracks ? 'Camera is off' : 'Turn on your camera to get ready'}
                    </p>
                    {!tracks && !camBusy && (
                      <Button variant="accent" className="mt-4" onClick={startCamera}>
                        <Camera className="size-4" aria-hidden /> Turn on camera & mic
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="absolute left-3 top-3">
                {isLive ? (
                  <LiveBadge viewers={rt.presence.viewerCount} />
                ) : (
                  tracks && (
                    <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">Preview · only you can see this</span>
                  )
                )}
              </div>
              {isLive && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
                  {reconnecting ? (
                    <>
                      <WifiOff className="size-3.5" aria-hidden /> Reconnecting…
                    </>
                  ) : lk.connection === 'connecting' ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden /> Connecting…
                    </>
                  ) : (
                    <>
                      <Clock className="size-3.5" aria-hidden /> {elapsed}
                    </>
                  )}
                </span>
              )}
              {/* The buyer at the counter: you hear them, and see them if they turn their camera on. */}
              {isLive && lk.counter?.audio && <TrackAudio track={lk.counter.audio} />}
              {isLive && lk.counter?.video && (
                <CounterTile label={lk.counter.name}>
                  <TrackVideo track={lk.counter.video} className="size-full object-cover" />
                </CounterTile>
              )}
              <PinnedProduct product={isLive ? rt.pinned : null} onClear={() => pin(null)} className="absolute inset-x-3 bottom-3 sm:right-auto sm:w-[22rem]" />
            </div>

            <div className="flex flex-wrap items-center gap-2 p-3">
              <Button
                variant={micOn ? 'outline' : 'danger'}
                size="sm"
                disabled={!audioTrack}
                onClick={() => toggle(audioTrack, micOn, setMicOn)}
                aria-pressed={!micOn}
              >
                {micOn ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4" aria-hidden />}
                {micOn ? 'Mute' : 'Unmute'}
              </Button>
              <Button
                variant={camOn ? 'outline' : 'danger'}
                size="sm"
                disabled={!videoTrack}
                onClick={() => toggle(videoTrack, camOn, setCamOn)}
                aria-pressed={!camOn}
              >
                {camOn ? <Camera className="size-4" aria-hidden /> : <CameraOff className="size-4" aria-hidden />}
                {camOn ? 'Stop video' : 'Start video'}
              </Button>
              <div className="ml-auto">
                {isLive ? (
                  <Button variant="danger" onClick={() => setConfirmEnd(true)}>
                    <Square className="size-4" aria-hidden /> End live
                  </Button>
                ) : (
                  <Button variant="accent" size="lg" onClick={goLive} loading={starting} disabled={!tracks}>
                    {!starting && <Radio className="size-4" aria-hidden />} Go live
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {isLive && <PresenceBar presence={rt.presence} />}
          {isLive && <SellerQueueCard rt={rt} products={products} />}

          {isLive && (requests.data?.requests.length ?? 0) > 0 && (
            <Card className="p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold">Waiting for a demo</h2>
                <Link to="/seller/requests" className="text-sm font-medium text-navy hover:underline">
                  All requests
                </Link>
              </div>
              <p className="text-sm text-muted">They asked while you were closed. Invite them in — they'll get a pop-up to join your queue.</p>
              <ul className="mt-3 divide-y divide-line">
                {requests.data.requests.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <ProductImage src={r.product?.images?.[0]} alt="" w={120} className="size-12 shrink-0 rounded-btn" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium text-ink">
                        {r.buyer?.name ?? 'A shopper'} · <span className="text-navy">{r.product?.name ?? r.departmentName ?? 'your shop'}</span>
                      </p>
                      {r.message && <p className="truncate text-muted">“{r.message}”</p>}
                    </div>
                    <InviteButton
                      request={r}
                      isLive
                      className="w-40 shrink-0"
                      onInvited={(u) =>
                        requests.setData((d) => ({ ...d, requests: d.requests.map((x) => (x.id === r.id ? { ...x, invitedAt: u.invitedAt, status: u.status } : x)) }))
                      }
                    />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Shelf */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold">Your shelf</h2>
              <Link to="/seller/products" className="text-sm font-medium text-navy hover:underline">
                Manage products
              </Link>
            </div>
            <p className="text-sm text-muted">
              {isLive ? 'Tap “Show” when you hold a product up — it slides up for everyone watching.' : 'Shoppers see these next to your video.'}
            </p>
            <FormError message={pinError} />
            {products.length ? (
              <ul className="mt-3 divide-y divide-line">
                {products.map((p) => {
                  const showing = rt.pinned?.id === p.id;
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <ProductImage src={p.images[0]} alt="" w={120} className="size-12 shrink-0 rounded-btn" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{p.name}</p>
                        <p className="text-sm text-muted">
                          {kes(p.price)} · {p.stock ? `${p.stock} in stock` : 'Out of stock'}
                        </p>
                      </div>
                      {isLive && (
                        <Button
                          size="sm"
                          variant={showing ? 'accent' : 'outline'}
                          onClick={() => pin(showing ? null : p.id)}
                          aria-pressed={showing}
                        >
                          {showing ? 'Showing' : 'Show'}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">
                No products yet. <Link to="/seller/products" className="font-medium text-navy hover:underline">Add your line-up</Link> so
                shoppers can see what you sell.
              </p>
            )}
          </Card>
        </div>

        {/* Right column: chat while live, tips before */}
        {isLive ? (
          <ChatPanel
            messages={rt.messages}
            canChat
            onSend={rt.send}
            disabled={rt.status !== 'live'}
            welcome="Shoppers' questions appear here. Your replies show with a Seller badge. Phone numbers and links are hidden automatically."
            className="h-[60dvh] overflow-hidden rounded-card border border-line lg:sticky lg:top-8 lg:h-[calc(100dvh-8rem)]"
          />
        ) : (
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="font-bold">Before you go live</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
                <li>Face a window or a lamp so shoppers see the product clearly.</li>
                <li>Have your products within reach to hold up to the camera.</li>
                <li>Use Wi-Fi if you can. Video adjusts on slow connections.</li>
                <li>If your connection drops, you have 2 minutes to come back before the room closes.</li>
              </ul>
            </Card>
            {openRequests > 0 && (
              <Link to="/seller/requests" className="block">
                <Card className="border-orange/40 bg-orange-soft p-5 hover:border-orange">
                  <p className="font-display text-2xl font-bold text-navy">{openRequests}</p>
                  <p className="text-sm text-ink">
                    {openRequests === 1 ? 'shopper is' : 'shoppers are'} waiting for a demonstration. Go live, then invite them in.
                    {inviteId && ' Your invite will be sent as soon as you go live.'}
                  </p>
                </Card>
              </Link>
            )}
          </div>
        )}
      </div>

      <Dialog open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End your live session?">
        <p className="text-muted">
          Everyone watching will see that your shop has closed. You can go live again at any time.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
            Stay live
          </Button>
          <Button variant="danger" onClick={endLive} loading={ending}>
            End live
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
