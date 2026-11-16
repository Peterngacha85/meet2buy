import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Clock, Loader2, Radio, Store as StoreIcon, Video, Volume2, WifiOff } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { SignBoard } from '../../features/mall/ShopSign.jsx';
import { ProductCard } from '../../features/mall/ProductCard.jsx';
import { ProductDialog } from '../../features/mall/ProductDialog.jsx';
import { ChatPanel } from '../../features/room/ChatPanel.jsx';
import { TrackAudio, TrackVideo } from '../../features/room/Media.jsx';
import { LiveBadge, PinnedProduct, PresenceBar } from '../../features/room/RoomBits.jsx';
import { BuyerQueueCard, CounterTile, JoinQueueDialog, TurnModal } from '../../features/room/Queue.jsx';
import { CheckoutDialog } from '../../features/commerce/CheckoutDialog.jsx';
import { PayPrompt } from '../../features/commerce/PayPrompt.jsx';
import { OfferCard } from '../../features/commerce/Offers.jsx';
import { askNotificationPermission, chime, flashTitle, systemNotify } from '../../store/notifyStore.js';
import { mediaErrorMessage, useLiveKit } from '../../features/room/useLiveKit.js';
import { useRoomSocket } from '../../features/room/useRoomSocket.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useFetch } from '../../hooks/useFetch.js';
import { api } from '../../services/api.js';
import { NotFound } from '../NotFound.jsx';

// The live room (doc 07): seller's video, product shelf, pinned product, presence and chat.
export function LiveRoom() {
  const { slug } = useParams();
  const { user, status } = useAuth();
  const room = useFetch(() => api.get(`/rooms/${slug}`), [slug, user?.id]);

  if (status === 'loading' || room.loading) return <Spinner label="Walking into the shop…" />;
  if (room.error?.status === 404 || !room.data) return <NotFound />;

  const { store, session, products, isOwner } = room.data;
  if (isOwner) return <OwnerNotice store={store} />;
  if (!session) return <ClosedScreen store={store} />;
  return <Room key={session.id} store={store} session={session} products={products} />;
}

function Room({ store, session, products }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tokenReq = useFetch(() => api.post(`/rooms/${session.id}/token`), [session.id, user?.id]);
  const lk = useLiveKit({ url: tokenReq.data?.livekit.url, token: tokenReq.data?.livekit.token });
  const rt = useRoomSocket(session.id);
  const [tab, setTab] = useState('chat');
  const [viewing, setViewing] = useState(null);
  const [joining, setJoining] = useState(null); // { product } while the join dialog is open
  const [buying, setBuying] = useState(null); // { product } | { offer } while checkout is open
  const [celebrate, setCelebrate] = useState(null);

  // ---- The counter (doc 07 §4): when called up, ask first ("It's your turn"), then turn the mic on ----
  const atCounter = rt.myQueue.status === 'at_counter';
  const [micWanted, setMicWanted] = useState(false);
  const [camWanted, setCamWanted] = useState(false);
  const [turnOpen, setTurnOpen] = useState(false);
  const [counterError, setCounterError] = useState('');
  const usedCounterToken = useRef(false);
  const { setMic, setCamera, stopPublishing } = lk;
  const reloadToken = tokenReq.reload;

  useEffect(() => {
    if (!rt.turn) return;
    setCounterError('');
    setTurnOpen(true);
    chime();
    systemNotify("It's your turn at the counter", `${store.name} is ready for you. Open Meet2buy to join.`);
    flashTitle('🔔 Your turn!');
  }, [rt.turn, store.name]);

  // Camera too, once the mic is on (if they chose it).
  useEffect(() => {
    if (!atCounter || !camWanted || !lk.local.mic || lk.local.camera) return;
    setCamWanted(false);
    setCamera(true).catch(() => setCounterError('Could not turn on your camera. The seller can still hear you.'));
  }, [atCounter, camWanted, lk.local.mic, lk.local.camera, setCamera]);

  // Came from a demo invite (?ask=<productId>): open "Join the queue" with that product, once.
  const [params, setParams] = useSearchParams();
  const askParam = params.get('ask');
  useEffect(() => {
    if (askParam === null || rt.status !== 'live') return;
    setParams((p) => {
      p.delete('ask');
      return p;
    }, { replace: true });
    if (!rt.canChat) {
      navigate(`/login?next=${encodeURIComponent(`/shop/${store.slug}/live?ask=${askParam}`)}`);
      return;
    }
    if (rt.myQueue.status) return; // already waiting or at the counter
    askNotificationPermission();
    setJoining({ product: products.find((p) => p.id === askParam) ?? null });
  }, [askParam, rt.status, rt.canChat, rt.myQueue.status, products, setParams, navigate, store.slug]);

  // "Someone just bought…" for a few seconds over the video.
  useEffect(() => {
    if (!rt.celebration) return undefined;
    setCelebrate(rt.celebration);
    const t = setTimeout(() => setCelebrate(null), 5000);
    return () => clearTimeout(t);
  }, [rt.celebration]);

  useEffect(() => {
    if (atCounter) return;
    setTurnOpen(false);
    setMicWanted(false);
    setCamWanted(false);
    stopPublishing();
    // Reconnected with a counter token earlier: go back to a watch-only token.
    if (usedCounterToken.current) {
      usedCounterToken.current = false;
      reloadToken();
    }
  }, [atCounter, stopPublishing, reloadToken]);

  useEffect(() => {
    if (!atCounter || lk.connection !== 'connected') return undefined;
    if (!micWanted) {
      if (lk.local.mic) setMic(false).catch(() => {});
      return undefined;
    }
    if (lk.local.mic) return undefined;
    let cancelled = false;
    (async () => {
      // The server grants publishing just before "your turn"; allow a moment for it to reach the video connection.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await setMic(true);
          return;
        } catch (err) {
          if (cancelled) return;
          if (['NotAllowedError', 'NotFoundError', 'NotReadableError'].includes(err?.name)) {
            setCounterError(mediaErrorMessage(err).replace('camera or microphone', 'microphone') + ' You can type in the chat instead.');
            setMicWanted(false);
            return;
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      if (cancelled) return;
      if (!usedCounterToken.current) {
        // Not granted on this connection: reconnect with a counter token.
        usedCounterToken.current = true;
        reloadToken();
      } else setCounterError('Could not turn on your microphone. You can type in the chat instead.');
    })();
    return () => {
      cancelled = true;
    };
  }, [atCounter, micWanted, lk.connection, lk.local.mic, setMic, reloadToken]);

  if (rt.status === 'closed' || tokenReq.error?.status === 404) {
    return <ClosedScreen store={store} message={rt.closed?.message} />;
  }

  const loginNext = () => navigate(`/login?next=${encodeURIComponent(`/shop/${store.slug}/live`)}`);
  const openJoin = (product) => {
    setViewing(null);
    if (!rt.canChat) return loginNext();
    askNotificationPermission(); // so "your turn" can reach them if they switch tabs
    setJoining({ product });
  };
  const openBuy = (product, variant = null) => {
    setViewing(null);
    if (!rt.canChat) return loginNext();
    setBuying({ product, variant });
  };
  const queueAhead = rt.myQueue.status === 'waiting' ? rt.myQueue.position - 1 : rt.queueLength;
  const otherAtCounter = !atCounter && lk.counter;

  const firstName = user?.name?.split(' ')[0];
  const welcome = `Welcome to ${store.name}${firstName ? `, ${firstName}` : ''}! Watch the demo, ask in the chat, or join the queue to talk to the seller at the counter.`;
  const offline = lk.connection === 'reconnecting' || rt.status === 'reconnecting';

  return (
    <div className="mx-auto max-w-7xl lg:px-4 lg:py-4">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-4">
        <div className="min-w-0">
          {/* Video stage */}
          <div className="sticky top-16 z-20 lg:static">
            <div className="relative aspect-video w-full overflow-hidden bg-navy-dark lg:rounded-card">
              {lk.seller.video ? (
                <TrackVideo track={lk.seller.video} className="absolute inset-0 size-full object-contain" />
              ) : (
                <div className="absolute inset-0 grid place-items-center px-6 text-center text-white/80">
                  <div>
                    {lk.connection === 'connecting' || tokenReq.loading ? (
                      <Loader2 className="mx-auto size-8 animate-spin text-orange" aria-hidden />
                    ) : (
                      <Video className="mx-auto size-8 text-orange" aria-hidden />
                    )}
                    <p className="mt-3 font-display text-lg font-bold text-white">
                      {lk.connection === 'connecting' || tokenReq.loading
                        ? 'Connecting to the shop…'
                        : rt.presence.sellerHere
                          ? 'The seller is setting up the camera…'
                          : 'The seller stepped away. Back in a moment.'}
                    </p>
                    {lk.error && <p className="mt-1 text-sm">{lk.error}</p>}
                  </div>
                </div>
              )}
              {lk.seller.audio && <TrackAudio track={lk.seller.audio} />}
              {/* The buyer at the counter: everyone else hears them (and sees them if they turn their camera on). */}
              {otherAtCounter && lk.counter.audio && <TrackAudio track={lk.counter.audio} />}
              {otherAtCounter && lk.counter.video && (
                <CounterTile label={`At the counter: ${lk.counter.name}`}>
                  <TrackVideo track={lk.counter.video} className="size-full object-cover" />
                </CounterTile>
              )}
              {atCounter && lk.local.camera && (
                <CounterTile label="You">
                  <TrackVideo track={lk.local.camera} mirror className="size-full object-cover" />
                </CounterTile>
              )}
              {rt.counter && !(otherAtCounter && lk.counter.video) && !(atCounter && lk.local.camera) && (
                <span className="absolute bottom-3 right-3 hidden rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white sm:inline-flex">
                  At the counter: {atCounter ? 'you' : rt.counter.buyer.name.split(' ')[0]}
                </span>
              )}

              <div className="absolute left-3 top-3">
                <LiveBadge viewers={rt.presence.viewerCount} />
              </div>
              {offline && (
                <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                  <WifiOff className="size-3.5" aria-hidden /> Reconnecting…
                </div>
              )}
              {!lk.canPlayAudio && lk.seller.video && (
                <button
                  type="button"
                  onClick={lk.startAudio}
                  className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-orange px-5 py-3 font-semibold text-navy shadow-lg hover:bg-orange-dark"
                >
                  <Volume2 className="size-5" aria-hidden /> Tap to hear the seller
                </button>
              )}
              {celebrate && (
                <div className="absolute inset-x-0 top-12 flex justify-center px-3">
                  <p key={celebrate.at} className="animate-rise rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-navy shadow-lg">
                    🎉 Someone just bought {celebrate.productName}
                  </p>
                </div>
              )}
              <PinnedProduct
                product={rt.pinned}
                onOpen={setViewing}
                onBuy={openBuy}
                className="absolute inset-x-3 bottom-3 sm:right-auto sm:w-[22rem]"
              />
            </div>
          </div>

          {/* Shop + presence */}
          <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:border-0 lg:px-0">
            <div className="flex items-center gap-3">
              <Link to={`/shop/${store.slug}`} className="block w-16 shrink-0 overflow-hidden rounded-btn" aria-label={`${store.name} shop page`}>
                <SignBoard store={{ ...store, isLive: false }} />
              </Link>
              <div>
                <h1 className="text-lg font-bold leading-tight">{store.name}</h1>
                <Link to={`/shop/${store.slug}`} className="text-sm text-muted hover:text-navy">
                  Visit the shop page
                </Link>
              </div>
            </div>
            <PresenceBar presence={rt.presence} />
          </div>

          {/* Offers from the seller, then the queue & counter */}
          <div className="space-y-3 px-4 pt-3 lg:px-0 lg:pt-0">
            {rt.offers.map((o) => (
              <OfferCard key={o.id} offer={o} onPay={(offer) => setBuying({ offer })} onDecline={rt.declineOffer} />
            ))}
            <BuyerQueueCard
              rt={rt}
              lk={lk}
              micWanted={micWanted}
              onMicToggle={() => setMicWanted((v) => !v)}
              counterError={counterError}
              onJoin={openJoin}
            />
          </div>

          {/* Mobile: chat / shelf tabs */}
          <div className="flex gap-2 px-4 pt-3 lg:hidden" role="tablist" aria-label="Room">
            {[
              ['chat', 'Chat'],
              ['shelf', `Products · ${products.length}`],
            ].map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  tab === key ? 'bg-navy text-white' : 'bg-white text-navy ring-1 ring-line'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Product shelf — always beside the video on desktop */}
          <section aria-labelledby="shelf-title" className={`px-4 pb-8 pt-4 lg:px-0 ${tab === 'shelf' ? '' : 'max-lg:hidden'}`}>
            <h2 id="shelf-title" className="mb-3 text-lg font-bold max-lg:sr-only">
              On the shelf
            </h2>
            {products.length ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => (
                  <li key={p.id} className={rt.pinned?.id === p.id ? 'rounded-card ring-2 ring-orange ring-offset-2' : ''}>
                    <ProductCard product={p} onOpen={setViewing} />
                  </li>
                ))}
              </ul>
            ) : (
              <Card className="px-6 py-8 text-center text-muted">Ask the seller what they have in stock.</Card>
            )}
          </section>
        </div>

        <ChatPanel
          messages={rt.messages}
          canChat={rt.canChat}
          onSend={rt.send}
          welcome={welcome}
          disabled={rt.status !== 'live'}
          className={`h-[60dvh] border-line lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)] lg:overflow-hidden lg:rounded-card lg:border ${
            tab === 'chat' ? '' : 'max-lg:hidden'
          }`}
        />
      </div>

      <ProductDialog
        product={viewing}
        onClose={() => setViewing(null)}
        onDemo={openJoin}
        onBuy={openBuy}
        demoLabel="Ask to see this"
        demoText="Join the queue for the counter: the seller shows it to you up close and you can ask anything, then pay with M-Pesa."
      />
      <JoinQueueDialog
        open={Boolean(joining)}
        product={joining?.product ?? null}
        waiting={queueAhead}
        onClose={() => setJoining(null)}
        onJoin={rt.joinQueue}
      />
      <TurnModal
        open={turnOpen && atCounter}
        storeName={store.name}
        product={rt.myQueue.product}
        onJoin={async ({ camera }) => {
          setTurnOpen(false);
          setCamWanted(camera);
          setMicWanted(true);
        }}
        onDecline={async () => {
          setTurnOpen(false);
          await rt.leaveQueue();
        }}
      />
      <PayPrompt offers={rt.offers} onPay={(offer) => setBuying({ offer })} />
      <CheckoutDialog item={buying} sessionId={session.id} payment={rt.payment} onClose={() => setBuying(null)} />
    </div>
  );
}

/** "We're closed" — doc 07 §7: friendly, with the way to ask for a demo later. */
function ClosedScreen({ store, message }) {
  const hours = store.openingHours ?? [];
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:py-16">
      <SignBoard store={{ ...store, isLive: false }} size="lg" />
      <Card className="mt-6 p-6 text-center sm:p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-navy-soft text-navy">
          <Clock className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold">{store.name} is closed right now</h1>
        <p className="mt-2 text-muted">{message ?? 'The seller is not live at the moment.'} You can still browse the line-up and ask for a demonstration — the seller will show it when they next open.</p>
        {hours.length > 0 && (
          <ul className="mx-auto mt-4 max-w-xs text-sm">
            {hours.map((h) => (
              <li key={h.day} className="flex justify-between border-b border-line py-1.5 last:border-0">
                <span className="font-medium text-ink">{h.day}</span>
                <span className="text-muted">
                  {h.open} – {h.close}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button to={`/shop/${store.slug}`} variant="accent">
            <StoreIcon className="size-4" aria-hidden /> See the line-up
          </Button>
          <Button to="/" variant="ghost">
            <ArrowLeft className="size-4" aria-hidden /> Back to the mall
          </Button>
        </div>
      </Card>
    </div>
  );
}

function OwnerNotice({ store }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">This is your shop</h1>
      <p className="mt-2 text-muted">
        Run your live room from Live control. Opening the shopper view with your own account would take the camera away from your
        broadcast — use another device or a guest window to see what shoppers see.
      </p>
      <Button to="/seller/live" variant="accent" className="mt-6">
        <Radio className="size-4" aria-hidden /> Go to Live control
      </Button>
      <p className="mt-3 text-sm">
        <Link to={`/shop/${store.slug}`} className="text-muted hover:text-navy">
          Back to the shop page
        </Link>
      </p>
    </div>
  );
}
