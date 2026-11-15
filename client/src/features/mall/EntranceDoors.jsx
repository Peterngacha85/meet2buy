import { useEffect, useRef } from 'react';
import { FullLogo } from '../../components/Logo.jsx';

/**
 * "Walk in" transition: glass mall doors close over the screen with the Meet2buy sign split
 * across them, the page moves to the directory behind them, then the doors slide open while
 * the view pushes forward, like stepping through the entrance.
 * onInside() runs while the doors are shut (move the page there); onDone() when they are open.
 */
export function EntranceDoors({ onInside, onDone }) {
  const overlay = useRef(null);
  const left = useRef(null);
  const right = useRef(null);
  const cb = useRef({ onInside, onDone });
  cb.current = { onInside, onDone };

  useEffect(() => {
    const ease = 'cubic-bezier(0.7, 0, 0.2, 1)';
    const running = [];
    const run = (el, frames, opts) => {
      const a = el.animate(frames, { fill: 'forwards', ...opts });
      running.push(a);
      return a.finished;
    };
    let cancelled = false;

    (async () => {
      try {
        // 1. Doors swing shut from the sides.
        await Promise.all([
          run(overlay.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }),
          run(left.current, [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }], { duration: 420, easing: ease }),
          run(right.current, [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { duration: 420, easing: ease }),
        ]);
        if (cancelled) return;
        cb.current.onInside();
        await new Promise((r) => setTimeout(r, 160));
        if (cancelled) return;

        // 2. Doors open while we "walk" forward.
        await Promise.all([
          run(left.current, [{ transform: 'translateX(0) scale(1)' }, { transform: 'translateX(-105%) scale(1.15)' }], {
            duration: 850,
            easing: ease,
          }),
          run(right.current, [{ transform: 'translateX(0) scale(1)' }, { transform: 'translateX(105%) scale(1.15)' }], {
            duration: 850,
            easing: ease,
          }),
          run(overlay.current, [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 850 }),
        ]);
      } catch {
        // animation cancelled (unmounted)
      }
      if (!cancelled) cb.current.onDone();
    })();

    return () => {
      cancelled = true;
      running.forEach((a) => a.cancel());
    };
  }, []);

  // Each door shows its half of one centred sign, so the sign splits as the doors part.
  const door = (side) => (
    <div
      ref={side === 'left' ? left : right}
      className={`absolute inset-y-0 w-1/2 overflow-hidden bg-gradient-to-b from-navy to-navy-dark ${
        side === 'left' ? 'left-0 origin-right border-r border-white/10' : 'right-0 origin-left border-l border-white/10'
      }`}
      style={{ transform: side === 'left' ? 'translateX(-100%)' : 'translateX(100%)' }}
    >
      {/* glass sheen */}
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.06)_45%,transparent_60%)]" />
      {/* door frame */}
      <div className="absolute inset-4 rounded-sm border border-white/10 sm:inset-8" />
      {/* the sign, centred on the seam */}
      <div className={`absolute top-0 flex h-full w-[100vw] items-center justify-center ${side === 'left' ? 'left-0' : '-left-[50vw]'}`}>
        <FullLogo inverse className="w-[min(72vw,520px)] drop-shadow-[0_0_30px_rgb(247_112_10/0.35)]" />
      </div>
      {/* handle */}
      <div
        className={`absolute top-1/2 mt-36 h-24 w-1.5 -translate-y-1/2 rounded-full bg-orange shadow-[0_0_16px_rgb(247_112_10/0.6)] sm:mt-48 sm:h-32 ${
          side === 'left' ? 'right-5 sm:right-8' : 'left-5 sm:left-8'
        }`}
      />
    </div>
  );

  return (
    <div ref={overlay} className="fixed inset-0 z-50 overflow-hidden opacity-0" aria-hidden>
      {door('left')}
      {door('right')}
    </div>
  );
}
