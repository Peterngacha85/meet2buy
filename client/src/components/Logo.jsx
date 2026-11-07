import { Link } from 'react-router';

// Generated from the client's logo (public/me2buy logo.jpeg).
// Replace with the designer's SVGs when they arrive (doc 03 §4) — same file names, .svg extension.
const ICON = '/logo-icon.png';
const ICON_WHITE = '/logo-icon-white.png';
const FULL = '/logo-full.png';
const FULL_WHITE = '/logo-full-white.png';

/** Bag + swoosh. Size it by height, e.g. className="h-8". */
export function LogoMark({ className = 'h-8', inverse = false }) {
  return <img src={inverse ? ICON_WHITE : ICON} alt="" className={`w-auto ${className}`} draggable={false} />;
}

/** Text wordmark with the orange "2" — used next to the mark where the full logo is too small to read. */
export function Wordmark({ inverse = false, className = '' }) {
  return (
    <span className={`font-display text-xl font-extrabold tracking-tight ${inverse ? 'text-white' : 'text-navy'} ${className}`}>
      Meet<span className="text-orange">2</span>buy
    </span>
  );
}

/** Full logo with tagline — hero, auth pages, footer. Size it by width, e.g. className="w-64". */
export function FullLogo({ className = 'w-64', inverse = false }) {
  return (
    <img
      src={inverse ? FULL_WHITE : FULL}
      alt="Meet2buy — Shop • Sell • Connect Globally"
      width="840"
      height="255"
      className={`h-auto ${className}`}
      draggable={false}
    />
  );
}

/** Navbar logo: mark + wordmark, links home. */
export function Logo({ inverse = false, to = '/' }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2" aria-label="Meet2buy home">
      <LogoMark inverse={inverse} />
      <Wordmark inverse={inverse} />
    </Link>
  );
}
