import { Eye, Users, X } from 'lucide-react';
import { ProductImage } from '../mall/ProductCard.jsx';
import { kes } from '../../utils/format.js';

/** "Live · 12 watching" badge over the video. */
export function LiveBadge({ viewers }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-navy">
        <span className="size-1.5 animate-live-pulse rounded-full bg-navy" aria-hidden /> Live
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
        <Eye className="size-3.5" aria-hidden /> {viewers} watching
      </span>
    </div>
  );
}

/** The product the seller is holding up: slides up over the bottom of the video. */
export function PinnedProduct({ product, onOpen, onClear, onBuy, className = '' }) {
  if (!product) return null;
  return (
    <div
      key={product.id}
      className={`flex animate-rise items-center gap-3 rounded-card bg-white/95 p-2.5 pr-3 shadow-lg ring-1 ring-black/5 backdrop-blur ${className}`}
    >
      <ProductImage src={product.images?.[0]} alt="" w={160} className="size-14 shrink-0 rounded-btn" />
      <button type="button" onClick={() => onOpen?.(product)} className="min-w-0 flex-1 text-left" disabled={!onOpen}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-ink">Showing now</p>
        <p className="truncate font-semibold text-ink">{product.name}</p>
        <p className="font-display font-bold text-navy">{kes(product.price)}</p>
      </button>
      {onBuy && product.stock > 0 && (
        <button
          type="button"
          onClick={() => onBuy(product)}
          className="shrink-0 rounded-btn bg-orange px-3.5 py-2 text-sm font-bold text-navy hover:bg-orange-dark"
        >
          Buy
        </button>
      )}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-btn p-1.5 text-muted hover:bg-bg-soft hover:text-navy"
          aria-label="Stop showing this product"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/** Other shoppers in the room, like people you can see in a shop. */
export function PresenceBar({ presence }) {
  const { viewerCount, shoppers } = presence;
  const guests = Math.max(0, viewerCount - shoppers.length);
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <Users className="size-4 shrink-0 text-navy" aria-hidden />
      {viewerCount === 0 ? (
        <span>You're the first one here</span>
      ) : (
        <>
          <ul className="flex -space-x-2" aria-label="Shoppers in the room">
            {shoppers.slice(0, 6).map((s) => (
              <li
                key={s.id}
                title={s.name}
                className="grid size-7 place-items-center rounded-full bg-navy-soft text-[11px] font-bold text-navy ring-2 ring-white"
              >
                {initials(s.name)}
              </li>
            ))}
          </ul>
          <span>
            {viewerCount} {viewerCount === 1 ? 'shopper' : 'shoppers'} in the shop
            {guests > 0 && shoppers.length > 0 ? ` (${guests} browsing as guests)` : ''}
          </span>
        </>
      )}
    </div>
  );
}
