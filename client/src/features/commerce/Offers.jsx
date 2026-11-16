import { useEffect, useState } from 'react';
import { BadgePercent, Tag } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Field.jsx';
import { FormError } from '../../pages/auth/AuthCard.jsx';
import { ProductImage } from '../mall/ProductCard.jsx';
import { clock } from '../room/useElapsed.js';
import { kes } from '../../utils/format.js';

function TimeLeft({ expiresAt }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return <span className={left < 60 ? 'text-danger' : 'text-muted'}>{left ? `${clock(left)} left` : 'expired'}</span>;
}

/** Buyer: the seller's offer, with Pay and Decline. */
export function OfferCard({ offer, onPay, onDecline }) {
  const [busy, setBusy] = useState(false);
  const expired = new Date(offer.expiresAt) <= new Date() && offer.status === 'pending';
  return (
    <Card className="animate-rise border-orange bg-orange-soft p-4 ring-2 ring-orange/30">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-orange-ink">
        <BadgePercent className="size-4" aria-hidden /> Ready to pay
        <span className="ml-auto normal-case tracking-normal">
          {offer.status === 'in_checkout' ? 'Paying…' : <TimeLeft expiresAt={offer.expiresAt} />}
        </span>
      </p>
      <div className="mt-2 flex items-center gap-3">
        <ProductImage src={offer.product.images?.[0]} alt="" w={120} className="size-14 shrink-0 rounded-btn" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{offer.product.name}</p>
          <p className="text-sm text-muted">
            {offer.quantity} × {offer.variant ? `· ${offer.variant}` : ''}
            {offer.product.price ? (
              <span className="ml-1 line-through">{kes(offer.product.price * offer.quantity)}</span>
            ) : null}
          </p>
        </div>
        <p className="font-display text-xl font-extrabold text-navy">{kes(offer.price)}</p>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="accent" className="flex-1 animate-pay-ring" onClick={() => onPay(offer)} disabled={expired}>
          PAY {kes(offer.price)}
        </Button>
        <Button
          variant="ghost"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await onDecline(offer.id);
            setBusy(false);
          }}
        >
          No thanks
        </Button>
      </div>
    </Card>
  );
}

/** Seller: send an offer (product, quantity, total price) to the buyer at the counter. */
export function OfferDialog({ open, buyer, products, defaultProductId, onClose, onSend }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [variant, setVariant] = useState('');
  const [skuId, setSkuId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const product = products.find((p) => p.id === productId);
  const skus = product?.skus ?? [];
  const sku = skus.find((s) => s.id === skuId) ?? null;
  const unit = sku?.price ?? product?.price ?? 0;
  const left = sku ? sku.stock : product?.stock ?? 0;
  const firstSku = (p) => p?.skus?.find((s) => s.stock > 0) ?? null;
  const pick = (p, qty = 1) => {
    const s = firstSku(p);
    setSkuId(s?.id ?? '');
    setPrice(p ? String((s?.price ?? p.price) * qty) : '');
  };

  useEffect(() => {
    if (!open) return;
    const first = defaultProductId ?? products[0]?.id ?? '';
    setProductId(first);
    setQuantity(1);
    setVariant('');
    setError('');
    pick(products.find((x) => x.id === first));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultProductId, products]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await onSend({
      buyerId: buyer.id,
      productId,
      ...(skus.length ? { skuId } : { variant }),
      quantity: Number(quantity),
      price: Number(price),
    });
    setBusy(false);
    if (res?.ok) onClose();
    else setError(res?.error ?? 'Offer not sent');
  }

  return (
    <Dialog open={open} onClose={onClose} title={`PAY button for ${buyer?.name ?? 'the shopper'}`}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Product"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setQuantity(1);
            pick(products.find((x) => x.id === e.target.value));
          }}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.stock}>
              {p.name} · {kes(p.price)} {p.stock ? '' : '(out of stock)'}
            </option>
          ))}
        </Select>
        {skus.length > 0 && (
          <Select
            label="Which one?"
            value={skuId}
            onChange={(e) => {
              setSkuId(e.target.value);
              setQuantity(1);
              const s = skus.find((x) => x.id === e.target.value);
              if (s) setPrice(String(s.price));
            }}
          >
            {skus.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.stock}>
                {Object.values(s.options).join(' / ')} · {kes(s.price)} {s.stock ? `(${s.stock} left)` : '(out of stock)'}
              </option>
            ))}
          </Select>
        )}
        {product?.variants?.length > 0 && !skus.length && (
          <Input
            label="Variant (optional)"
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            placeholder={product.variants.map((v) => `${v.label}: ${v.options[0]}`).join(' · ')}
            maxLength={80}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity"
            type="number"
            min={1}
            max={Math.min(10, left || 10)}
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              if (product) setPrice(String(unit * Number(e.target.value || 1)));
            }}
            required
          />
          <Input label="Total price (KES)" type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        {product && Number(price) < unit * Number(quantity || 1) && (
          <p className="text-sm text-success">
            {kes(unit * Number(quantity || 1) - Number(price))} off the listed price
          </p>
        )}
        <FormError message={error} />
        <Button type="submit" variant="accent" className="w-full" loading={busy} disabled={!productId || (skus.length > 0 && !sku)}>
          <Tag className="size-4" aria-hidden /> Send PAY button
        </Button>
        <p className="text-center text-xs text-muted">
          A PAY pop-up appears on their screen at once. They enter their M-Pesa number and approve the prompt on their phone — the money
          reaches you through Meet2buy. It expires after 10 minutes.
        </p>
      </form>
    </Dialog>
  );
}
