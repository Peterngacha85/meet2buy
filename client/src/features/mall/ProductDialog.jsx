import { useEffect, useState } from 'react';
import { ShoppingBag, Video } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ProductImage } from './ProductCard.jsx';
import { kes } from '../../utils/format.js';
import { findSku, optionAvailable, priceLabel } from './variations.js';

export function ProductDialog({
  product,
  onClose,
  onDemo,
  onBuy = null,
  demoLabel = 'Get a live demonstration',
  demoText = 'See it demonstrated live by a salesperson, ask anything, then pay with M-Pesa.',
}) {
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState({});
  useEffect(() => {
    setActive(0);
    setChosen({});
  }, [product]);
  const hasSkus = product?.skus?.length > 0;
  const sku = hasSkus ? findSku(product, chosen) : null;
  const allChosen = (product?.variants ?? []).every((v) => chosen[v.label]);
  const price = sku ? kes(sku.price) : product ? priceLabel(product) : '';
  const stock = sku ? sku.stock : product?.stock ?? 0;
  const canBuy = hasSkus ? Boolean(sku && sku.stock > 0) : stock > 0;

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
            <p className="font-display text-[28px] font-bold text-navy">{price}</p>
            <p className={`text-sm font-medium ${stock ? 'text-success' : 'text-danger'}`}>
              {hasSkus && !allChosen
                ? `Choose ${product.variants.filter((v) => !chosen[v.label]).map((v) => v.label.toLowerCase()).join(' and ')}`
                : hasSkus && !sku
                  ? 'Not available in this combination'
                  : stock
                    ? stock <= 3
                      ? `Only ${stock} left`
                      : `${stock} in stock`
                    : 'Out of stock'}
            </p>
            {product.variants?.map((v) => (
              <fieldset key={v.label} className="mt-4">
                <legend className="mb-1.5 text-sm font-medium text-ink">
                  {v.label}
                  {chosen[v.label] && <span className="font-normal text-muted">: {chosen[v.label]}</span>}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {v.options.map((o) => {
                    const on = chosen[v.label] === o;
                    const possible = optionAvailable(product, chosen, v.label, o);
                    return (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setChosen((c) => ({ ...c, [v.label]: on ? undefined : o }))}
                        className={`rounded-btn border px-3 py-1.5 text-sm font-medium transition-colors ${
                          on
                            ? 'border-navy bg-navy text-white'
                            : possible
                              ? 'border-line bg-white text-ink hover:border-navy/50'
                              : 'border-dashed border-line bg-white text-muted line-through'
                        }`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            {product.description && <p className="mt-4 whitespace-pre-line text-[15px] text-ink">{product.description}</p>}

            <div className="mt-6 rounded-card bg-orange-soft p-4 sm:mt-auto">
              <p className="font-display font-bold text-navy">Ready to buy?</p>
              <p className="mb-3 text-sm text-ink">{demoText}</p>
              {onBuy && (
                <Button
                  variant="primary"
                  className="mb-2 w-full"
                  onClick={() => onBuy(product, hasSkus ? chosen : null)}
                  disabled={hasSkus ? allChosen && !canBuy : !product.stock}
                >
                  <ShoppingBag className="size-4" aria-hidden /> Buy now · {price}
                </Button>
              )}
              <Button variant={onBuy ? 'outline' : 'accent'} className="w-full" onClick={() => onDemo(product)} disabled={!product.stock}>
                <Video className="size-4" aria-hidden /> {demoLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
