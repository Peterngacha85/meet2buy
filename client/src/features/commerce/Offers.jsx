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
        <BadgePercent className="size-4" aria-hidden /> Offer for you
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
        <Button variant="accent" className="flex-1" onClick={() => onPay(offer)} disabled={expired}>
          Pay {kes(offer.price)}
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const product = products.find((p) => p.id === productId);

  useEffect(() => {
    if (!open) return;
    const first = defaultProductId ?? products[0]?.id ?? '';
    setProductId(first);
    setQuantity(1);
    setVariant('');
    setError('');
    const p = products.find((x) => x.id === first);
    setPrice(p ? String(p.price) : '');
  }, [open, defaultProductId, products]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await onSend({ buyerId: buyer.id, productId, quantity: Number(quantity), price: Number(price), variant });
    setBusy(false);
    if (res?.ok) onClose();
    else setError(res?.error ?? 'Offer not sent');
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Offer for ${buyer?.name ?? 'the shopper'}`}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Product"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            const p = products.find((x) => x.id === e.target.value);
            if (p) setPrice(String(p.price * Number(quantity || 1)));
          }}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.stock}>
              {p.name} · {kes(p.price)} {p.stock ? '' : '(out of stock)'}
            </option>
          ))}
        </Select>
        {product?.variants?.length > 0 && (
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
            max={Math.min(10, product?.stock ?? 10)}
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              if (product) setPrice(String(product.price * Number(e.target.value || 1)));
            }}
            required
          />
          <Input label="Total price (KES)" type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        {product && Number(price) < product.price * Number(quantity || 1) && (
          <p className="text-sm text-success">
            {kes(product.price * Number(quantity || 1) - Number(price))} off the listed price
          </p>
        )}
        <FormError message={error} />
        <Button type="submit" variant="accent" className="w-full" loading={busy} disabled={!productId}>
          <Tag className="size-4" aria-hidden /> Send offer
        </Button>
        <p className="text-center text-xs text-muted">The shopper sees it at once and pays with M-Pesa. Offers expire after 10 minutes.</p>
      </form>
    </Dialog>
  );
}
