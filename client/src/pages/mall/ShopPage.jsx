import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ChevronRight, Eye, Video } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StatusPill } from '../../components/ui/StatusPill.jsx';
import { SignBoard } from '../../features/mall/ShopSign.jsx';
import { ProductCard } from '../../features/mall/ProductCard.jsx';
import { ProductDialog } from '../../features/mall/ProductDialog.jsx';
import { DemoRequestDialog } from '../../features/mall/DemoRequestDialog.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api } from '../../services/api.js';
import { imgUrl } from '../../services/uploads.js';
import { NotFound } from '../NotFound.jsx';

// Shop → departments → product line-up → "Ready to buy? Click for a demonstration by a salesperson."
export function ShopPage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const shop = useFetch(() => api.get(`/stores/${slug}`), [slug]);
  const wingsReq = useFetch(() => api.get('/stores/wings'));

  const [viewing, setViewing] = useState(null); // product in the details dialog
  const [demo, setDemo] = useState(null); // { product } when the demo dialog is open

  const store = shop.data?.store;
  const products = useMemo(() => shop.data?.products ?? [], [shop.data]);
  const departments = store?.departments ?? [];
  const current = departments.find((d) => d.slug === params.get('dept')) ?? departments[0];
  const lineUp = products.filter((p) => p.department === current?.id);
  const wingName = (slugOrNull) => wingsReq.data?.wings.find((w) => w.slug === slugOrNull)?.name;

  if (shop.loading) return <Spinner label="Walking to the shop…" />;
  if (shop.error?.status === 404 || !store) return <NotFound />;

  const countIn = (d) => products.filter((p) => p.department === d.id).length;
  const openDemo = (product = null) => {
    setViewing(null);
    setDemo({ product });
  };

  return (
    <div className="pb-16">
      {shop.data.preview && (
        <div className="bg-[#FFF4D6] text-[#8A6100]">
          <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 text-sm font-medium">
            <Eye className="size-4" aria-hidden /> Preview — this shop is {shop.data.preview} and not yet visible in the mall.
          </p>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 py-4 text-sm text-muted">
          <Link to="/" className="hover:text-navy">
            Mall
          </Link>
          {current && wingName(current.wing) && (
            <>
              <ChevronRight className="size-3.5" aria-hidden />
              <Link to={`/?wing=${current.wing}`} className="hover:text-navy">
                {wingName(current.wing)}
              </Link>
            </>
          )}
          <ChevronRight className="size-3.5" aria-hidden />
          <span className="font-medium text-ink">{store.name}</span>
        </nav>

        {/* Shop front */}
        <SignBoard store={store} size="lg" />
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] font-extrabold sm:text-[34px]">{store.name}</h1>
              {store.isLive ? <StatusPill status="live">Live now</StatusPill> : <StatusPill status="closed">Closed now</StatusPill>}
            </div>
            {store.description && <p className="mt-1 max-w-2xl text-muted">{store.description}</p>}
          </div>
          <Button variant="accent" onClick={() => openDemo()} className="shrink-0">
            <Video className="size-4" aria-hidden /> Get a live demonstration
          </Button>
        </div>
        {store.banner && (
          <img
            src={imgUrl(store.banner, { w: 1600, h: 480, fill: true })}
            alt=""
            className="mt-6 aspect-[10/3] w-full rounded-card object-cover"
          />
        )}
      </div>

      {/* Departments */}
      <div className="sticky top-16 z-20 mt-8 border-y border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3" role="tablist" aria-label="Departments">
          {departments.map((d) => (
            <button
              key={d.id}
              role="tab"
              aria-selected={d.id === current?.id}
              onClick={() => setParams({ dept: d.slug }, { replace: true, preventScrollReset: true })}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                d.id === current?.id ? 'bg-navy text-white' : 'bg-white text-navy ring-1 ring-line hover:ring-navy/40'
              }`}
            >
              {d.name}
              <span className={d.id === current?.id ? 'text-white/70' : 'text-muted'}> · {countIn(d)}</span>
            </button>
          ))}
        </div>
      </div>

      {current && (
        <section className="mx-auto max-w-6xl px-4 pt-8" aria-labelledby="dept-title">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-ink">Department</p>
          <h2 id="dept-title" className="mt-1 text-2xl font-bold sm:text-[28px]">
            {current.name}
          </h2>
          <p className="text-sm text-muted">Product line-up</p>

          {lineUp.length ? (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {lineUp.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} onOpen={setViewing} />
                </li>
              ))}
            </ul>
          ) : (
            <Card className="mt-5 px-6 py-10 text-center text-muted">
              No products in {current.name} yet. Ask the salesperson what they have in stock.
            </Card>
          )}

          {/* The owner's flow: line-up → ready to buy? → demonstration by a salesperson */}
          <div className="mt-8 flex flex-col gap-4 rounded-card bg-navy p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="font-display text-xl font-extrabold sm:text-2xl">Ready to buy?</p>
              <p className="mt-1 text-white/80">
                Click for a demonstration by a {store.name} salesperson. Ask anything, then pay with M-Pesa.
              </p>
            </div>
            <Button variant="accent" size="lg" onClick={() => openDemo()} className="shrink-0">
              <Video className="size-4" aria-hidden /> Get a demonstration
            </Button>
          </div>
        </section>
      )}

      <ProductDialog product={viewing} onClose={() => setViewing(null)} onDemo={openDemo} />
      <DemoRequestDialog
        open={Boolean(demo)}
        onClose={() => setDemo(null)}
        store={store}
        department={current}
        products={lineUp}
        product={demo?.product}
      />
    </div>
  );
}
