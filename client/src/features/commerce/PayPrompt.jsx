import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { ProductImage } from '../mall/ProductCard.jsx';
import { kes } from '../../utils/format.js';

/** A short two-note chime and a buzz on phones, so the PAY button isn't missed mid-conversation. */
function chime() {
  try {
    navigator.vibrate?.([120, 60, 120]);
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g).connect(ctx.destination);
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.start(t);
      o.stop(t + 0.32);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch {
    /* sound is a nice-to-have */
  }
}

/**
 * Buyer: the seller pressed "Send PAY button" at the counter. A pop-up over the video with one big
 * PAY button: no Till or Paybill numbers are read out in the room. "Not now" keeps the offer card
 * in the side panel until it expires.
 */
export function PayPrompt({ offers, onPay }) {
  const seen = useRef(new Set());
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const fresh = offers.find((o) => o.status === 'pending' && !seen.current.has(o.id) && new Date(o.expiresAt) > new Date());
    // After a refresh, an offer still open pops up once more: handy if the page reloaded mid-sale.
    if (!fresh) return;
    seen.current.add(fresh.id);
    setCurrent(fresh);
    chime();
  }, [offers]);

  // Gone (paid, declined, replaced or expired)? Close the pop-up.
  const live = current && offers.find((o) => o.id === current.id && o.status === 'pending');
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (live && !d.open) d.showModal();
    if (!live && d.open) d.close();
  }, [live]);

  const close = () => setCurrent(null);

  return (
    <dialog
      ref={ref}
      onClose={close}
      aria-labelledby="pay-prompt-title"
      className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-card bg-white p-0 text-ink shadow-2xl backdrop:bg-navy-dark/70"
    >
      {live && (
        <div className="animate-rise">
          <div className="bg-navy px-5 pb-5 pt-4 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange">From the counter</p>
            <h2 id="pay-prompt-title" className="mt-1 font-display text-xl font-bold text-white">
              Ready when you are
            </h2>
          </div>
          <div className="-mt-3 rounded-t-card bg-white px-5 pb-5 pt-5">
            <div className="flex items-center gap-3">
              <ProductImage src={live.product.images?.[0]} alt="" w={160} className="size-16 shrink-0 rounded-btn border border-line" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-semibold text-ink">{live.product.name}</p>
                <p className="text-sm text-muted">
                  {live.quantity} ×{live.variant ? ` · ${live.variant}` : ''}
                </p>
              </div>
            </div>
            <p className="mt-4 text-center font-display text-[34px] font-extrabold leading-none text-navy">{kes(live.price)}</p>
            {live.product.price && live.product.price * live.quantity > live.price && (
              <p className="mt-1 text-center text-sm text-success">
                You save {kes(live.product.price * live.quantity - live.price)}
              </p>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => {
                close();
                onPay(live);
              }}
              className="mt-5 flex h-16 w-full animate-pay-ring items-center justify-center gap-2 rounded-btn bg-orange font-display text-2xl font-extrabold tracking-wide text-navy transition-colors hover:bg-orange-dark"
            >
              <Smartphone className="size-6" aria-hidden /> PAY
            </button>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted">
              <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
              Enter your M-Pesa number and approve the prompt on your phone. Never pay to a number read out in the room.
            </p>
            <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={close}>
              Not now
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
