import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Camera, CameraOff, Clock, Hand, LogOut, Mic, MicOff, PhoneCall, SkipForward, UserRound } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Textarea } from '../../components/ui/Field.jsx';
import { FormError } from '../../pages/auth/AuthCard.jsx';
import { ProductImage } from '../mall/ProductCard.jsx';
import { clock, useElapsedSeconds } from './useElapsed.js';
import { kes } from '../../utils/format.js';

const NOTE_MAX = 140;

function ProductChip({ product, label }) {
  if (!product) return null;
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-btn bg-bg-soft p-2">
      <ProductImage src={product.images?.[0]} alt="" w={96} className="size-10 shrink-0 rounded-md" />
      <div className="min-w-0 text-sm">
        {label && <p className="text-xs text-muted">{label}</p>}
        <p className="truncate font-medium text-ink">{product.name}</p>
        <p className="text-xs font-semibold text-navy">{kes(product.price)}</p>
      </div>
    </div>
  );
}

/** "Ask to see this" / "Join the queue" with an optional question for the seller. */
export function JoinQueueDialog({ open, product, onClose, onJoin, waiting }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setNote('');
      setError('');
    }
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await onJoin(product?.id ?? null, note.trim());
    setBusy(false);
    if (res?.ok) onClose();
    else setError(res?.error ?? 'Could not join the queue');
  }

  return (
    <Dialog open={open} onClose={onClose} title={product ? 'Ask to see this' : 'Join the queue'}>
      <form onSubmit={submit}>
        <p className="text-sm text-muted">
          Like waiting at a shop counter: when it's your turn the seller calls you up, and you can talk to them with your
          microphone. {waiting > 0 ? `${waiting} ${waiting === 1 ? 'person is' : 'people are'} ahead of you.` : 'Nobody is waiting — you’re next.'}
        </p>
        <ProductChip product={product} label="You want to see" />
        <Textarea
          className="mt-4"
          label="Question for the seller (optional)"
          placeholder="e.g. Does it come in black? Can you show the back?"
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          hint={`${NOTE_MAX - note.length} characters left. Phone numbers and links are hidden.`}
          rows={2}
        />
        <div className="mt-5">
          <FormError message={error} />
          <Button type="submit" variant="accent" className="w-full" loading={busy}>
            <Hand className="size-4" aria-hidden /> Join the queue
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Buyer's side of the queue: join, your position, or "you're at the counter" with mic/camera controls. */
export function BuyerQueueCard({ rt, lk, micWanted, onMicToggle, counterError, onJoin }) {
  const location = useLocation();
  const [camBusy, setCamBusy] = useState(false);
  const [camError, setCamError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const { myQueue, queueLength, canChat } = rt;
  const elapsed = useElapsedSeconds(myQueue.status === 'at_counter' ? rt.turn?.at ?? rt.counter?.calledAt : null);

  if (!canChat) {
    return (
      <Card className="p-4">
        <p className="font-semibold text-ink">Want a closer look?</p>
        <p className="mt-1 text-sm text-muted">Log in to join the queue and talk to the seller at the counter.</p>
        <Button to={`/login?next=${encodeURIComponent(location.pathname)}`} variant="outline" size="sm" className="mt-3">
          Log in to join the queue
        </Button>
      </Card>
    );
  }

  const leave = async () => {
    setLeaving(true);
    await rt.leaveQueue();
    setLeaving(false);
  };

  if (myQueue.status === 'at_counter') {
    const toggleCamera = async () => {
      setCamBusy(true);
      setCamError('');
      try {
        await lk.setCamera(!lk.local.camera);
      } catch {
        setCamError('Could not turn on your camera. The seller can still hear you.');
      } finally {
        setCamBusy(false);
      }
    };
    return (
      <Card className="border-orange bg-orange-soft p-4 ring-2 ring-orange/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-display text-lg font-extrabold text-navy">
              <PhoneCall className="size-5" aria-hidden /> You're at the counter
            </p>
            <p className="text-sm text-ink">
              {lk.local.mic ? 'The seller and the room can hear you. Ask away!' : 'Turn on your microphone to talk to the seller.'}
            </p>
          </div>
          {elapsed != null && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted">
              <Clock className="size-3.5" aria-hidden /> {clock(elapsed)}
            </span>
          )}
        </div>
        <ProductChip product={myQueue.product} label="You asked to see" />
        <FormError message={counterError || camError} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant={micWanted ? 'primary' : 'danger'} onClick={onMicToggle} aria-pressed={!micWanted}>
            {micWanted ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4" aria-hidden />}
            {micWanted ? 'Mute' : 'Unmute'}
          </Button>
          <Button size="sm" variant="outline" onClick={toggleCamera} loading={camBusy}>
            {!camBusy && (lk.local.camera ? <CameraOff className="size-4" aria-hidden /> : <Camera className="size-4" aria-hidden />)}
            {lk.local.camera ? 'Stop my camera' : 'Show my camera'}
          </Button>
          <Button size="sm" variant="ghost" onClick={leave} loading={leaving} className="ml-auto">
            <LogOut className="size-4" aria-hidden /> I'm done
          </Button>
        </div>
      </Card>
    );
  }

  if (myQueue.status === 'waiting') {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-navy text-white">
            <span className="font-display text-2xl font-extrabold">#{myQueue.position}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">
              You're #{myQueue.position} of {myQueue.total} in the queue
            </p>
            <p className="text-sm text-muted">
              {myQueue.position === 1 ? 'You’re next! Keep this page open.' : 'Keep this page open — we’ll call you up.'}
            </p>
          </div>
        </div>
        <ProductChip product={myQueue.product} label="You want to see" />
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="ghost" onClick={leave} loading={leaving}>
            Leave the queue
          </Button>
        </div>
      </Card>
    );
  }

  const notice = {
    skipped: 'The seller moved on before your turn. You can join the queue again.',
    served: 'Thanks for visiting the counter! Join again if you have more questions.',
  }[myQueue.notice];

  return (
    <Card className="p-4">
      {notice && <p className="mb-3 rounded-btn bg-navy-soft px-3 py-2 text-sm text-navy">{notice}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-ink">Want a closer look or have a question?</p>
          <p className="text-sm text-muted">
            {queueLength > 0 ? `${queueLength} waiting at the counter.` : 'Nobody is waiting — you’d be next.'}
          </p>
        </div>
        <Button variant="accent" onClick={() => onJoin(null)} className="shrink-0">
          <Hand className="size-4" aria-hidden /> Join the queue
        </Button>
      </div>
    </Card>
  );
}

function WaitedFor({ since }) {
  const s = useElapsedSeconds(since);
  if (s == null) return null;
  const m = Math.floor(s / 60);
  return <span>{m < 1 ? 'just now' : `${m} min`}</span>;
}

/** Seller's counter: who is up, their timer, and the waiting line (doc 07 §4). */
export function SellerQueueCard({ rt }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const current = rt.queue.find((e) => e.status === 'at_counter');
  const waiting = rt.queue.filter((e) => e.status === 'waiting');
  const elapsed = useElapsedSeconds(rt.counter?.calledAt ?? null);
  const limit = (rt.counter?.timeLimitMinutes ?? 5) * 60;
  const timesUp = elapsed != null && elapsed >= limit;

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    const res = await fn();
    setBusy('');
    if (!res?.ok) setError(res?.error ?? 'Something went wrong');
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">Counter</h2>
        <span className="text-sm text-muted">{waiting.length} waiting</span>
      </div>

      <div className={`mt-3 rounded-card p-3.5 ${current ? (timesUp ? 'bg-[#FDE8E7]' : 'bg-orange-soft') : 'bg-bg-soft'}`}>
        {current ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-orange-ink">At the counter</p>
                <p className="flex items-center gap-1.5 font-display text-lg font-bold text-navy">
                  <UserRound className="size-4" aria-hidden /> {current.buyer.name}
                </p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 text-sm font-semibold ${timesUp ? 'text-danger' : 'text-muted'}`}>
                <Clock className="size-4" aria-hidden /> {clock(elapsed)}
              </span>
            </div>
            {timesUp && (
              <p className="mt-1 text-sm font-medium text-danger">
                Time's up ({rt.counter.timeLimitMinutes} min). Wrap up, or keep going if they're about to buy.
              </p>
            )}
            {current.note && <p className="mt-2 rounded-btn bg-white/70 px-2.5 py-1.5 text-sm text-ink">“{current.note}”</p>}
            <ProductChip product={current.product} label="Wants to see" />
          </>
        ) : (
          <p className="text-sm text-muted">Nobody at the counter. Call the next shopper when you're ready.</p>
        )}
      </div>

      <FormError message={error} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="accent"
          onClick={() => run('next', rt.callNext)}
          loading={busy === 'next'}
          disabled={!waiting.length && !current}
          className="flex-1"
        >
          {busy !== 'next' && <PhoneCall className="size-4" aria-hidden />}
          {waiting.length ? `Call next (${waiting[0].buyer.name.split(' ')[0]})` : current ? 'Finish' : 'Call next'}
        </Button>
        {current && waiting.length > 0 && (
          <Button variant="outline" onClick={() => run('end', rt.endCounter)} loading={busy === 'end'}>
            End turn
          </Button>
        )}
      </div>

      {waiting.length > 0 && (
        <ol className="mt-4 divide-y divide-line">
          {waiting.map((e, i) => (
            <li key={e.id} className="flex items-start gap-3 py-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-soft text-xs font-bold text-navy">{i + 1}</span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-ink">
                  {e.buyer.name}
                  <span className="ml-2 text-xs font-normal text-muted">
                    <WaitedFor since={e.createdAt} />
                  </span>
                </p>
                {e.product && <p className="truncate text-muted">Wants to see: {e.product.name}</p>}
                {e.note && <p className="text-muted">“{e.note}”</p>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => run(`skip-${e.id}`, () => rt.skip(e.id))}
                loading={busy === `skip-${e.id}`}
                aria-label={`Skip ${e.buyer.name}`}
              >
                <SkipForward className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {!waiting.length && !current && (
        <p className="mt-3 text-sm text-muted">
          Shoppers tap “Join the queue” or “Ask to see this” on a product. They'll line up here.
        </p>
      )}
    </Card>
  );
}

/** Small picture-in-picture of the buyer at the counter (or yourself), over the main video. */
export function CounterTile({ children, label }) {
  return (
    <div className="absolute right-3 top-12 w-28 sm:bottom-3 sm:top-auto overflow-hidden rounded-btn bg-navy shadow-lg ring-2 ring-orange sm:w-40">
      <div className="aspect-[4/3]">{children}</div>
      <p className="truncate bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{label}</p>
    </div>
  );
}
