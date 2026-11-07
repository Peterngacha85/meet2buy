import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowDown, Search, Store } from 'lucide-react';
import { FullLogo } from '../../components/Logo.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StatusPill } from '../../components/ui/StatusPill.jsx';
import { ShopSign } from '../../features/mall/ShopSign.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api } from '../../services/api.js';

// The mall entrance (owner's brief): Meet2buy is the mall, the businesses are the shops.
// Keep it uncluttered — the Meet2buy sign, what this place is, and the shop signs inside.

function Stat({ value, label }) {
  return (
    <div className="px-4 sm:px-6">
      <p className="font-display text-2xl font-extrabold text-white sm:text-[28px]">{value}</p>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/60">{label}</p>
    </div>
  );
}

function Entrance({ totals, wingCount }) {
  return (
    <section className="relative overflow-hidden bg-navy-dark text-white">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-orange/15 blur-[120px]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-12 text-center sm:pb-16 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-orange">Welcome to</p>
        <h1 className="sr-only">Meet2buy, the virtual shopping mall</h1>
        {/* The sign over the entrance */}
        <div className="mx-auto mt-5 w-fit rounded-[22px] border border-white/15 bg-white/[0.04] px-6 py-5 shadow-[0_0_80px_-20px_rgb(247_112_10/0.6)] sm:px-10 sm:py-7">
          <FullLogo inverse className="w-[min(78vw,540px)]" />
        </div>
        <p className="mx-auto mt-7 max-w-xl text-lg text-white/85 sm:text-xl">
          The virtual shopping mall. Walk in, choose a shop, and meet the person selling it.
        </p>

        <div className="mx-auto mt-8 flex w-fit divide-x divide-white/15">
          <Stat value={totals.shops} label={totals.shops === 1 ? 'Shop' : 'Shops'} />
          <Stat value={wingCount} label={wingCount === 1 ? 'Wing' : 'Wings'} />
          <Stat value={totals.live} label="Live now" />
        </div>

        <Button
          variant="accent"
          size="lg"
          className="mt-9"
          onClick={() => document.getElementById('directory')?.scrollIntoView({ behavior: 'smooth' })}
        >
          Walk in <ArrowDown className="size-4" aria-hidden />
        </Button>
      </div>
      {/* entrance canopy */}
      <div className="h-1.5 bg-orange" aria-hidden />
    </section>
  );
}

function WingSection({ wing, stores }) {
  return (
    <section aria-labelledby={`wing-${wing.slug}`} className="scroll-mt-24">
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-3">
        <h3 id={`wing-${wing.slug}`} className="text-xl font-bold sm:text-2xl">
          {wing.name} <span className="font-sans text-base font-medium text-muted">wing</span>
        </h3>
        <p className="shrink-0 text-sm text-muted">
          {stores.length} {stores.length === 1 ? 'shop' : 'shops'}
        </p>
      </div>
      {stores.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {stores.map((s) => (
            <li key={s.id}>
              <ShopSign store={s} wing={wing.slug} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          No shops in this wing yet.
        </p>
      )}
    </section>
  );
}

export function MallHome() {
  const wingsReq = useFetch(() => api.get('/stores/wings'));
  const storesReq = useFetch(() => api.get('/stores'));
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const activeWing = params.get('wing') ?? 'all';

  const wings = wingsReq.data?.wings ?? [];
  const totals = wingsReq.data?.totals ?? { shops: 0, live: 0 };
  const stores = storesReq.data?.stores ?? [];

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return stores;
    return stores.filter(
      (s) => s.name.toLowerCase().includes(term) || s.departments.some((d) => d.name.toLowerCase().includes(term)),
    );
  }, [stores, q]);

  const live = stores.filter((s) => s.isLive);
  const shownWings = activeWing === 'all' ? wings : wings.filter((w) => w.slug === activeWing);
  const loading = wingsReq.loading || storesReq.loading;

  const tab = (slug, label, count) => (
    <button
      key={slug}
      onClick={() => setParams(slug === 'all' ? {} : { wing: slug }, { replace: true, preventScrollReset: true })}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        activeWing === slug ? 'bg-navy text-white' : 'bg-white text-navy ring-1 ring-line hover:ring-navy/40'
      }`}
      aria-pressed={activeWing === slug}
    >
      {label}
      {count !== undefined && <span className={activeWing === slug ? 'text-white/70' : 'text-muted'}> · {count}</span>}
    </button>
  );

  return (
    <>
      <Entrance totals={totals} wingCount={wings.length} />

      {live.length > 0 && (
        <section className="bg-bg-soft">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-2xl font-bold">Live now</h2>
              <StatusPill status="live">{live.length} live</StatusPill>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {live.map((s) => (
                <li key={s.id}>
                  <ShopSign store={s} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="directory" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-10 sm:py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-ink">Mall directory</p>
            <h2 className="mt-1 text-[26px] font-bold sm:text-[32px]">Choose a shop</h2>
          </div>
          <label className="relative block sm:w-72">
            <span className="sr-only">Find a shop</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a shop or department"
              className="h-11 w-full rounded-btn border border-line bg-white pl-10 pr-3.5 text-[15px] focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/25"
            />
          </label>
        </div>

        {wings.length > 1 && (
          <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Wings">
            {tab('all', 'All wings')}
            {wings.map((w) => tab(w.slug, w.name, w.shopCount))}
          </div>
        )}

        {loading ? (
          <Spinner label="Opening the mall…" />
        ) : totals.shops === 0 ? (
          <Card className="mt-8 flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-navy-soft text-navy">
              <Store className="size-6" aria-hidden />
            </span>
            <p className="font-semibold text-ink">The first shops are moving in</p>
            <p className="max-w-sm text-sm text-muted">Brands are setting up their shops in Meet2buy. Come back soon.</p>
            <Button to="/open-store" variant="accent" className="mt-2">
              Own a business? Open your shop
            </Button>
          </Card>
        ) : (
          <div className="mt-8 space-y-12">
            {shownWings.map((w) => (
              <WingSection key={w.slug} wing={w} stores={matches.filter((s) => s.wings.includes(w.slug))} />
            ))}
            {q && !matches.length && (
              <p className="text-center text-muted">No shop or department matches &ldquo;{q}&rdquo;.</p>
            )}
          </div>
        )}
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Own a business?</h2>
            <p className="text-muted">Open your shop in Meet2buy for free. You only pay a small commission when you sell.</p>
          </div>
          <Button to="/open-store" variant="accent">
            Open your shop free
          </Button>
        </div>
      </section>
    </>
  );
}
