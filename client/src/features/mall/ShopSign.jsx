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
