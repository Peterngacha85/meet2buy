import { Eye } from 'lucide-react';
import { LogoMark } from '../../components/Logo.jsx';

// Decorative preview of a live room for the mall entrance hero.
// Sample content only — not real data.
const IMG_SRCSET = '/hero-seller-800.webp 800w, /hero-seller-1400.webp 1400w';

const chat = [
  { name: 'Wanjiku', text: 'Does it come in black?' },
  { name: 'Amani Bags', text: 'Yes! Showing it next 👜', seller: true },
  { name: 'Brian', text: 'Joined the queue', system: true },
];

function Rise({ delay, className = '', children }) {
  return (
    <div className={`animate-rise ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function HeroRoomPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <figure className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-navy shadow-[0_24px_60px_-20px_rgba(11,31,92,0.45)] ring-1 ring-navy/10 sm:aspect-[5/4] lg:aspect-[4/5]">
        <img
          src="/hero-seller-1400.webp"
          srcSet={IMG_SRCSET}
          sizes="(min-width: 1024px) 520px, 100vw"
          width="1400"
          height="788"
          alt="A seller showing a tan leather handbag to her phone camera during a live stream from her boutique"
          className="absolute inset-0 size-full object-cover object-[68%_50%]"
          fetchPriority="high"
        />
        {/* Legibility gradients */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-navy-dark/55 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-navy-dark/85 via-navy-dark/40 to-transparent" aria-hidden />

        <div aria-hidden>
          {/* Top bar */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-navy">
                <span className="size-1.5 rounded-full bg-navy animate-live-pulse" />
                Live
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-dark/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                <Eye className="size-3.5" /> 23 shoppers
              </span>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-3 text-xs font-semibold text-navy">
              <span className="grid size-6 place-items-center rounded-full bg-navy-soft">
                <LogoMark className="h-3.5" />
              </span>
              Amani Bags
            </span>
          </div>

          {/* Chat + pinned product */}
          <div className="absolute inset-x-0 bottom-0 space-y-2 p-4">
            {chat.map((m, i) => (
              <Rise key={m.name} delay={600 + i * 700}>
                {m.system ? (
                  <p className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                    <span className="font-semibold">{m.name}</span> · {m.text}
                  </p>
                ) : (
                  <p className="inline-block max-w-[85%] rounded-2xl rounded-bl-md bg-white/95 px-3 py-1.5 text-[13px] text-ink">
                    <span className={`mr-1.5 font-semibold ${m.seller ? 'text-orange-ink' : 'text-navy'}`}>
                      {m.name}
                      {m.seller && (
                        <span className="ml-1 rounded bg-orange-soft px-1 py-px align-middle text-[10px] font-bold uppercase text-orange-ink">
                          Seller
                        </span>
                      )}
                    </span>
                    {m.text}
                  </p>
                )}
              </Rise>
            ))}

            <Rise delay={300} className="!mt-3">
              <div className="flex items-center gap-3 rounded-card bg-white p-2.5 pr-3 shadow-lg">
                <span
                  className="size-14 shrink-0 rounded-btn bg-bg-soft bg-no-repeat"
                  style={{
                    backgroundImage: 'url(/hero-seller-800.webp)',
                    backgroundSize: '420%',
                    backgroundPosition: '54% 66%',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Pinned</p>
                  <p className="truncate text-sm font-semibold text-ink">Tan leather top-handle bag</p>
                  <p className="font-display text-base font-extrabold text-orange-ink">KES 4,500</p>
                </div>
                <span className="inline-flex h-9 shrink-0 items-center rounded-btn bg-orange px-3.5 text-sm font-semibold text-navy">
                  Buy now
                </span>
              </div>
            </Rise>
          </div>
        </div>
      </figure>

      {/* "Just bought" toast, floating over the card edge */}
      <Rise delay={2900} className="absolute -right-2 top-16 sm:-right-6" aria-hidden>
        <div className="flex items-center gap-2 rounded-full bg-white py-2 pl-2 pr-4 text-sm font-medium text-ink shadow-lg ring-1 ring-line">
          <span className="grid size-7 place-items-center rounded-full bg-orange-soft text-base">🎉</span>
          Someone just bought this bag
        </div>
      </Rise>
    </div>
  );
}
