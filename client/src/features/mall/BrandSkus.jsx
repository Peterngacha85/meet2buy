import { Link } from 'react-router';
import { ChevronRight, Video } from 'lucide-react';
import { ShopSign } from './ShopSign.jsx';
import { ProductImage } from './ProductCard.jsx';
import { kes } from '../../utils/format.js';

/** One SKU in a brand's line-up: tap the card for details, or go straight to a demonstration. */
function SkuCard({ product, onOpen, onDemo }) {
  const soldOut = product.stock === 0;
  return (
    <div className="flex h-full w-40 shrink-0 snap-start flex-col overflow-hidden rounded-card border border-line bg-white sm:w-44">
      <button type="button" onClick={() => onOpen(product)} className="group flex flex-1 flex-col text-left">
        <ProductImage src={product.images[0]} alt={product.name} w={360} className="aspect-square w-full" />
        <span className="flex flex-1 flex-col gap-0.5 px-3 pt-2.5">
          <span className="line-clamp-2 text-sm font-medium text-ink group-hover:text-navy">{product.name}</span>
          <span className="mt-auto pt-1 font-display font-bold text-navy">{kes(product.price)}</span>
          <span className={`text-xs font-medium ${soldOut ? 'text-danger' : 'text-muted'}`}>
            {soldOut ? 'Out of stock' : product.stock <= 3 ? `Only ${product.stock} left` : 'In stock'}
          </span>
        </span>
      </button>
      <div className="p-3 pt-2">
        <button
          type="button"
          onClick={() => onDemo(product)}
          disabled={soldOut}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-btn bg-orange text-sm font-semibold text-navy transition-colors hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Video className="size-4" aria-hidden /> Demonstration
        </button>
      </div>
    </div>
  );
}

/**
 * A brand inside a wing: its shop sign, then every SKU it lists there, each with a
 * "Demonstration" button (client feedback: list all SKUs per brand so buyers go straight
 * to a demonstration and purchase).
 */
export function BrandSkus({ store, wing, products, onOpen, onDemo }) {
  const to = `/shop/${store.slug}`;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      <div className="w-full sm:w-52 sm:shrink-0">
        <ShopSign store={store} wing={wing} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </p>
          <Link to={to} className="inline-flex items-center text-sm font-semibold text-navy hover:underline">
            Visit shop <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        {products.length ? (
          <ul
            className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
            aria-label={`${store.name} products`}
          >
            {products.map((p) => (
              <li key={p.id} className="flex">
                <SkuCard product={p} onOpen={onOpen} onDemo={onDemo} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-line px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>No products listed here yet. Ask the salesperson what they have.</span>
            <button
              type="button"
              onClick={() => onDemo(null)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-btn bg-orange px-3 text-sm font-semibold text-navy hover:bg-orange-dark"
            >
              <Video className="size-4" aria-hidden /> Demonstration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
