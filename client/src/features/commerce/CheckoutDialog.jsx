import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Loader2, Minus, Plus, Smartphone, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Select, Textarea } from '../../components/ui/Field.jsx';
import { FormError } from '../../pages/auth/AuthCard.jsx';
import { ProductImage } from '../mall/ProductCard.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { kes } from '../../utils/format.js';
import { findSku, optionAvailable } from '../mall/variations.js';

const SAVED = 'm2b_delivery';
const POLL_MS = 5000;
const SHOW_RETRY_AFTER_MS = 60_000;

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(SAVED) || '{}');
  } catch {
    return {};
  }
}
function save(v) {
  try {
    localStorage.setItem(SAVED, JSON.stringify(v));
  } catch {
    /* private mode: fine */
  }
}
const displayPhone = (p) => (p?.startsWith('254') ? `0${p.slice(3)}` : p ?? '');

/**
 * Checkout sheet (doc 02 §2.3 step 7): quantity, M-Pesa number, delivery → Pay → STK prompt on the phone.
 * `item` is { product } for Buy now at the listed price, or { offer } for the seller's offer.
 * `payment` is the latest payment:status from the room socket (the poll is the fallback).
 */
export function CheckoutDialog({ item, sessionId, payment, onClose }) {
  const { user } = useAuth();
  const open = Boolean(item);
  const product = item?.product ?? null;
  const offer = item?.offer ?? null;

  const [step, setStep] = useState('form'); // form | waiting | success | failed | on_hold
  const [form, setForm] = useState({});
  const [variant, setVariant] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const [simulated, setSimulated] = useState(false);
  const [result, setResult] = useState(null);
  const [slow, setSlow] = useState(false);
  const [editDelivery, setEditDelivery] = useState(true);
  const startedAt = useRef(0);

  // Fresh form each time the sheet opens, prefilled from last time.
  useEffect(() => {
    if (!open) return;
    const saved = loadSaved();
    setForm({
      mpesaPhone: saved.mpesaPhone ?? displayPhone(user?.phone),
      name: saved.name ?? user?.name ?? '',
      phone: saved.phone ?? displayPhone(user?.phone),
      location: saved.location ?? '',
      notes: '',
    });
    // PAY from the counter: with delivery details saved from last time, only the M-Pesa number is asked.
    setEditDelivery(!(item?.offer && saved.name && saved.phone && saved.location));
    setVariant(Object.fromEntries(Object.entries(item?.variant ?? {}).filter(([, v]) => v)));
    setQuantity(1);
    setErrors({});
    setError('');
    setStep('form');
    setOrder(null);
    setResult(null);
    setSlow(false);
  }, [open, user]);

  const settle = (status, message, receipt) => {
    setResult({ message, receipt });
    setStep(status === 'success' ? 'success' : status === 'on_hold' ? 'on_hold' : 'failed');
  };

  // Live result from the room socket.
  useEffect(() => {
    if (step === 'waiting' && payment && order && payment.orderId === order.id) settle(payment.status, payment.message, payment.receipt);
  }, [payment, order, step]);

  // Fallback: poll the order (the server also asks M-Pesa directly if the callback is late).
  useEffect(() => {
    if (step !== 'waiting' || !order) return undefined;
    const t = setInterval(async () => {
      if (Date.now() - startedAt.current > SHOW_RETRY_AFTER_MS) setSlow(true);
      try {
        const { order: o } = await unwrap(api.get(`/orders/${order.id}/status`));
        if (o.status === 'paid') settle('success', null, o.payment?.receipt);
        else if (o.status === 'on_hold') settle('on_hold', 'We received a payment and are confirming it. Meet2buy will update your order.');
        else if (['payment_failed', 'cancelled'].includes(o.status)) settle('failed', o.payment?.message);
      } catch {
        /* keep waiting */
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [step, order]);

  if (!open) return <Dialog open={false} onClose={onClose} title="" />;

  const name = offer ? offer.product.name : product.name;
  const image = offer ? offer.product.images?.[0] : product.images?.[0];
  const sku = product?.skus?.length ? findSku(product, variant) : null;
  const unit = sku?.price ?? product?.price ?? 0;
  const notStocked = Boolean(product?.skus?.length && product.variants.every((v) => variant[v.label]) && (!sku || !sku.stock));
  const maxQty = Math.max(1, Math.min(10, (sku ?? product)?.stock ?? 1));
  const total = offer ? offer.price : unit * quantity;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function pay(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError('');
    const delivery = { name: form.name, phone: form.phone, location: form.location, notes: form.notes };
    try {
      const body = offer
        ? { offerId: offer.id, mpesaPhone: form.mpesaPhone, delivery }
        : { productId: product.id, quantity, variant, sessionId, mpesaPhone: form.mpesaPhone, delivery };
      const data = await unwrap(api.post('/orders/checkout', body));
      save({ mpesaPhone: form.mpesaPhone, name: form.name, phone: form.phone, location: form.location });
      setOrder(data.order);
      setSimulated(data.simulated);
      startedAt.current = Date.now();
      setStep('waiting');
    } catch (err) {
      const { message, fieldErrors } = apiError(err);
      const mapped = {};
      for (const [k, v] of Object.entries(fieldErrors)) mapped[k.replace(/^delivery\./, '')] = v;
      setErrors(mapped);
      if (['name', 'phone', 'location'].some((k) => mapped[k])) setEditDelivery(true);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function simulate(action) {
    setBusy(true);
    try {
      const { order: o } = await unwrap(api.post(`/orders/${order.id}/simulate`, { action }));
      if (o.status === 'paid') settle('success', null, o.payment?.receipt);
      else settle('failed', 'You cancelled the M-Pesa prompt.');
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const summary = (
    <div className="flex items-center gap-3 rounded-card bg-bg-soft p-3">
      <ProductImage src={image} alt="" w={120} className="size-14 shrink-0 rounded-btn" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{name}</p>
        <p className="text-sm text-muted">
          {offer
            ? `${offer.quantity} × · seller's offer${offer.variant ? ` · ${offer.variant}` : ''}`
            : `${kes(unit)} each${sku ? ` · ${Object.values(sku.options).join(' / ')}` : ''}`}
        </p>
      </div>
      <p className="font-display text-lg font-bold text-navy">{kes(total)}</p>
    </div>
  );

  return (
    <Dialog open onClose={onClose} dismissable={step !== 'waiting'} title={step === 'form' && !offer ? 'Checkout' : 'Pay with M-Pesa'}>
      {step === 'form' && (
        <form onSubmit={pay} className="space-y-4">
          {summary}
          {!offer && (
            <div className="grid gap-3 sm:grid-cols-2">
              {product.variants?.map((v) => (
                <Select
                  key={v.label}
                  label={v.label}
                  value={variant[v.label] ?? ''}
                  onChange={(e) => {
                    setVariant((s) => ({ ...s, [v.label]: e.target.value }));
                    setQuantity(1);
                  }}
                  error={errors[`variant.${v.label}`]}
                  required
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {v.options.map((o) => (
                    <option key={o} disabled={!optionAvailable(product, variant, v.label, o)}>
                      {o}
                    </option>
                  ))}
                </Select>
              ))}
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Quantity</p>
                <div className="flex h-11 items-center gap-1 rounded-btn border border-line bg-white px-1">
                  <button type="button" className="grid size-9 place-items-center rounded-btn text-navy hover:bg-bg-soft disabled:opacity-40" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Fewer">
                    <Minus className="size-4" />
                  </button>
                  <span className="flex-1 text-center font-semibold" aria-live="polite">
                    {quantity}
                  </span>
                  <button type="button" className="grid size-9 place-items-center rounded-btn text-navy hover:bg-bg-soft disabled:opacity-40" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty} aria-label="More">
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <Input
            label="M-Pesa number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.mpesaPhone ?? ''}
            onChange={set('mpesaPhone')}
            error={errors.mpesaPhone}
            hint="You'll get a prompt on this phone to enter your M-Pesa PIN."
            required
            autoFocus={Boolean(offer)}
          />

          {!editDelivery ? (
            <div className="flex items-start justify-between gap-3 rounded-card border border-line px-3.5 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-navy">Deliver to</p>
                <p className="truncate text-ink">
                  {form.name} · {form.phone}
                </p>
                <p className="truncate text-muted">{form.location}</p>
              </div>
              <button type="button" className="shrink-0 font-semibold text-navy underline" onClick={() => setEditDelivery(true)}>
                Change
              </button>
            </div>
          ) : (
          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-semibold text-navy">Delivery</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Name" value={form.name ?? ''} onChange={set('name')} error={errors.name} autoComplete="name" required />
              <Input label="Phone" type="tel" value={form.phone ?? ''} onChange={set('phone')} error={errors.phone} autoComplete="tel" required />
            </div>
            <Input label="Location / address" value={form.location ?? ''} onChange={set('location')} error={errors.location} placeholder="e.g. Kilimani, Argwings Kodhek Rd, Apt 4B" required />
            <Textarea label="Notes for the seller (optional)" value={form.notes ?? ''} onChange={set('notes')} rows={2} maxLength={300} />
          </fieldset>
          )}

          <FormError message={notStocked ? 'That combination is out of stock. Choose another option.' : error} />
          <Button type="submit" variant="accent" size="lg" className="w-full" loading={busy} disabled={notStocked}>
            Pay {kes(total)} with M-Pesa
          </Button>
          <p className="text-center text-xs text-muted">
            Meet2buy collects the payment and sends it to {offer ? 'the seller' : 'the shop'} straight away. Returns are arranged with the seller.
          </p>
        </form>
      )}

      {step === 'waiting' && (
        <div className="space-y-4 text-center">
          {summary}
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-orange-soft text-orange-ink">
            <Smartphone className="size-7" aria-hidden />
          </span>
          <div>
            <p className="font-display text-xl font-bold text-navy">Check your phone</p>
            <p className="mt-1 text-muted">
              Enter your M-Pesa PIN on {displayPhone(order?.payment?.phone) || form.mpesaPhone} to pay {kes(order?.amount)}.
            </p>
          </div>
          {simulated ? (
            <div className="rounded-card border border-dashed border-orange bg-orange-soft p-4 text-left">
              <p className="text-sm font-semibold text-orange-ink">Test mode — no real money</p>
              <p className="mt-1 text-sm text-ink">M-Pesa isn't connected yet. Pretend this is the prompt on your phone:</p>
              <div className="mt-3 flex gap-2">
                <Button variant="primary" className="flex-1" onClick={() => simulate('pay')} loading={busy}>
                  Pay (enter PIN)
                </Button>
                <Button variant="outline" onClick={() => simulate('cancel')} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="inline-flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin text-navy" aria-hidden /> Waiting for M-Pesa…
            </p>
          )}
          <FormError message={error} />
          {slow && (
            <p className="text-sm text-muted">
              Didn't get the prompt?{' '}
              <button className="font-semibold text-navy underline" onClick={() => setStep('form')}>
                Try again
              </button>
            </p>
          )}
        </div>
      )}

      {step === 'success' && (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden />
          <div>
            <p className="font-display text-xl font-bold text-navy">Payment received</p>
            {result?.receipt && <p className="mt-1 text-sm text-muted">M-Pesa receipt {result.receipt}</p>}
          </div>
          {summary}
          <p className="text-sm text-ink">The seller will contact you on {form.phone} to arrange delivery to {form.location}.</p>
          <div className="flex gap-2">
            <Button to={order ? `/receipt/${order.id}` : '/orders'} variant="outline" className="flex-1">
              View receipt
            </Button>
            <Button variant="accent" className="flex-1" onClick={onClose}>
              Back to the shop
            </Button>
          </div>
        </div>
      )}

      {(step === 'failed' || step === 'on_hold') && (
        <div className="space-y-4 text-center">
          {step === 'failed' ? (
            <XCircle className="mx-auto size-14 text-danger" aria-hidden />
          ) : (
            <Loader2 className="mx-auto size-14 text-navy" aria-hidden />
          )}
          <div>
            <p className="font-display text-xl font-bold text-navy">{step === 'failed' ? 'Payment not completed' : 'Confirming your payment'}</p>
            <p className="mt-1 text-muted">{result?.message ?? 'The payment did not go through. You were not charged.'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Close
            </Button>
            {step === 'failed' ? (
              <Button variant="accent" className="flex-1" onClick={() => setStep('form')}>
                Try again
              </Button>
            ) : (
              <Button to="/orders" variant="outline" className="flex-1">
                My orders
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">
            Questions? <Link to="/orders" className="underline">See your orders</Link>.
          </p>
        </div>
      )}
    </Dialog>
  );
}
