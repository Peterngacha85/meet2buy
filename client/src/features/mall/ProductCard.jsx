import { Package } from 'lucide-react';
import { imgUrl } from '../../services/uploads.js';
import { kes } from '../../utils/format.js';

export function ProductImage({ src, alt, className = '', w = 480 }) {
  if (!src) {
    return (
      <div className={`grid place-items-center bg-bg-soft text-muted/60 ${className}`} aria-hidden>
        <Package className="size-10" strokeWidth={1.5} />
      </div>
    );
  }
  return <img src={imgUrl(src, { w })} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}

/** One product in a department's line-up. */
export function ProductCard({ product, onOpen }) {
  const soldOut = product.stock === 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      className="group flex h-full w-full flex-col overflow-hidden rounded-card border border-line bg-white text-left transition hover:border-navy/30 hover:shadow-[0_10px_30px_-14px_rgb(11_31_92/0.35)]"
    >
      <ProductImage src={product.images[0]} alt={product.name} className="aspect-square w-full" />
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <p className="line-clamp-2 font-medium text-ink">{product.name}</p>
        <p className="mt-auto pt-1 font-display text-lg font-bold text-navy">{kes(product.price)}</p>
        <p className={`text-xs font-medium ${soldOut ? 'text-danger' : 'text-muted'}`}>
          {soldOut ? 'Out of stock' : product.stock <= 3 ? `Only ${product.stock} left` : 'In stock'}
        </p>
      </div>
    </button>
  );
}
