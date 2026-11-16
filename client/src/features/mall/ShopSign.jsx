import { Link } from 'react-router';
import { imgUrl } from '../../services/uploads.js';
import { StatusPill } from '../../components/ui/StatusPill.jsx';

/**
 * A shop's signage board inside the mall: its own colour and logo, like the lit
 * sign above a shop front. Without a logo the shop name is lettered on the board.
 */
export function SignBoard({ store, size = 'md', className = '' }) {
  const { name, logo, brandColor = '#0B1F5C', isLive } = store;
  const big = size === 'lg';

  return (
    <div
      className={`relative grid place-items-center overflow-hidden ${big ? 'aspect-[16/7] rounded-card sm:aspect-[4/1] lg:aspect-[5/1]' : 'aspect-[16/7]'} ${className}`}
      style={{ backgroundColor: brandColor }}
    >
      {/* soft light across the top of the board */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-black/15" aria-hidden />
      {logo ? (
        <span
          className={`relative grid place-items-center rounded-xl bg-white shadow-sm ${
            big ? 'h-[62%] w-[min(70%,22rem)] px-6' : 'h-[64%] w-[78%] px-4'
          }`}
        >
          <img
            src={imgUrl(logo, { w: big ? 640 : 360 })}
            alt={`${name} logo`}
            className="max-h-[78%] max-w-full object-contain"
            loading="lazy"
            draggable={false}
          />
        </span>
      ) : (
        <span
          className={`relative px-4 text-center font-display font-extrabold uppercase leading-none tracking-[0.08em] text-white [text-shadow:0_1px_10px_rgb(255_255_255/0.25)] ${
            big
              ? 'text-[clamp(28px,6vw,52px)]'
              : name.length > 10
                ? 'text-base sm:text-xl'
                : name.length > 6
                  ? 'text-lg sm:text-2xl'
                  : 'text-2xl sm:text-[26px]'
          }`}
        >
          {name}
        </span>
      )}
      {isLive && (
        <span className="absolute right-2.5 top-2.5">
          <StatusPill status="live">Live</StatusPill>
        </span>
      )}
    </div>
  );
}

/** "Live now" tile: goes straight into the shop's live room, with how many are watching. */
export function LiveShopTile({ store }) {
  return (
    <Link
      to={`/shop/${store.slug}/live`}
      className="group block overflow-hidden rounded-card border border-line bg-white transition duration-200 hover:-translate-y-0.5 hover:border-orange hover:shadow-[0_10px_30px_-12px_rgb(247_112_10/0.45)]"
    >
      <SignBoard store={store} />
      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <p className="truncate font-semibold text-navy">{store.name}</p>
        <span className="shrink-0 text-xs font-medium text-muted">{store.viewers ?? 0} watching</span>
      </div>
      <p className="border-t border-line px-3.5 py-2 text-sm font-semibold text-orange-ink group-hover:text-navy">Walk in →</p>
    </Link>
  );
}

/** Directory tile: signboard + shop name and its departments. */
export function ShopSign({ store, wing }) {
  // Coming from a wing, open the shop on that wing's first department.
  const dept = wing ? store.departments.find((d) => d.wing === wing) : null;
  const departments = (wing ? store.departments.filter((d) => d.wing === wing) : store.departments).map((d) => d.name);
  const to = `/shop/${store.slug}${dept ? `?dept=${dept.slug}` : ''}`;

  return (
    <Link
      to={to}
      className="group block overflow-hidden rounded-card border border-line bg-white transition duration-200 hover:-translate-y-0.5 hover:border-navy/30 hover:shadow-[0_10px_30px_-12px_rgb(11_31_92/0.35)]"
    >
      <SignBoard store={store} />
      <div className="px-3.5 py-3">
        <p className="truncate font-semibold text-navy">{store.name}</p>
        <p className="truncate text-sm text-muted">{departments.join(' · ')}</p>
      </div>
    </Link>
  );
}

/**
 * Landing-page shop card (client brief, Nov 2026: the mall shows shops, not products). Banner (or the
 * shop's colour) with the logo on top, the name and departments; the products are inside the shop.
 */
export function ShopCard({ store, wing }) {
  const { name, logo, banner, brandColor = '#0B1F5C', isLive, slug } = store;
  const dept = wing ? store.departments.find((d) => d.wing === wing) : null;
  const departments = (wing ? store.departments.filter((d) => d.wing === wing) : store.departments).map((d) => d.name);
  const to = `/shop/${slug}${dept ? `?dept=${dept.slug}` : ''}`;

  return (
    <Link
      to={to}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-white transition duration-200 hover:-translate-y-1 hover:border-navy/30 hover:shadow-[0_14px_34px_-14px_rgb(11_31_92/0.4)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden" style={{ backgroundColor: brandColor }}>
        {banner ? (
          <img
            src={imgUrl(banner, { w: 720 })}
            alt=""
            loading="lazy"
            draggable={false}
            className="size-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/25" aria-hidden />
        )}
        {banner && <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" aria-hidden />}
        {!logo && !banner && (
          <span className="absolute inset-0 grid place-items-center px-4 text-center font-display text-2xl font-extrabold uppercase tracking-[0.08em] text-white">
            {name}
          </span>
        )}
        {isLive && (
          <span className="absolute right-3 top-3">
            <StatusPill status="live">Live now</StatusPill>
          </span>
        )}
      </div>

      <div className="relative flex flex-1 flex-col px-4 pb-4">
        {/* Logo badge overlapping the banner */}
        <span className="-mt-8 mb-2 grid size-16 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md" style={logo ? undefined : { backgroundColor: brandColor }}>
          {logo ? (
            <img src={imgUrl(logo, { w: 160 })} alt={`${name} logo`} loading="lazy" draggable={false} className="max-h-full max-w-full object-contain p-1" />
          ) : (
            <span className="font-display text-xl font-extrabold text-white">{name.slice(0, 1).toUpperCase()}</span>
          )}
        </span>
        <p className="truncate font-display text-lg font-bold text-navy">{name}</p>
        <p className="line-clamp-1 text-sm text-muted">{departments.join(' · ') || 'Shop'}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-orange-ink group-hover:text-navy">
          {isLive ? 'Walk in — they’re live' : 'Visit shop'} <span aria-hidden>→</span>
        </span>
      </div>
    </Link>
  );
}
