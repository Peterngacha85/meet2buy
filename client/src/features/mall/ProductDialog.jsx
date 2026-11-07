import { useEffect, useState } from 'react';
import { Video } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ProductImage } from './ProductCard.jsx';
import { kes } from '../../utils/format.js';

export function ProductDialog({ product, onClose, onDemo }) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [product]);

  return (
    <Dialog open={Boolean(product)} onClose={onClose} title={product?.name ?? ''} wide>
      {product && (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <ProductImage
              src={product.images[active]}
              alt={product.name}
              w={900}
              className="aspect-square w-full rounded-card border border-line"
            />
            {product.images.length > 1 && (
              <div className="mt-2 flex gap-2">
                {product.images.map((src, i) => (
                  <button
                    key={src}
                    onClick={() => setActive(i)}
                    className={`overflow-hidden rounded-btn border-2 ${i === active ? 'border-navy' : 'border-transparent'}`}
                    aria-label={`Photo ${i + 1}`}
                  >
                    <ProductImage src={src} alt="" w={120} className="size-14" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <p className="font-display text-[28px] font-bold text-navy">{kes(product.price)}</p>
            <p className={`text-sm font-medium ${product.stock ? 'text-success' : 'text-danger'}`}>
              {product.stock ? `${product.stock} in stock` : 'Out of stock'}
            </p>
            {product.variants?.map((v) => (
              <p key={v.label} className="mt-3 text-sm">
                <span className="font-medium text-ink">{v.label}:</span> <span className="text-muted">{v.options.join(', ')}</span>
              </p>
            ))}
            {product.description && <p className="mt-4 whitespace-pre-line text-[15px] text-ink">{product.description}</p>}

            <div className="mt-6 rounded-card bg-orange-soft p-4 sm:mt-auto">
              <p className="font-display font-bold text-navy">Ready to buy?</p>
              <p className="mb-3 text-sm text-ink">See it demonstrated live by a salesperson, ask anything, then pay with M-Pesa.</p>
              <Button variant="accent" className="w-full" onClick={() => onDemo(product)} disabled={!product.stock}>
                <Video className="size-4" aria-hidden /> Get a live demonstration
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
