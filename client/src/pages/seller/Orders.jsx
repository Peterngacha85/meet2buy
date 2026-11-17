import { Link } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { Phone, Receipt, Truck, FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StatusPill } from '../../components/ui/StatusPill.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { ProductImage } from '../../features/mall/ProductCard.jsx';
import { ORDER_LABEL } from '../account/MyOrders.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { useNotifyStore } from '../../store/notifyStore.js';
import { kes, timeAgo } from '../../utils/format.js';

const PAYOUT_LABEL = {
  pending: ['Payout queued', 'text-muted'],
  processing: ['Sending to you…', 'text-orange-ink'],
  completed: ['Paid to you', 'text-success'],
  failed: ['Payout delayed — Meet2buy is on it', 'text-danger'],
};

// Doc 02 §1.6: paid orders with delivery details, commission, payout status; mark shipped / delivered.
export function SellerOrders() {
  const { data, loading, error, reload, setData } = useFetch(() => api.get('/orders/store'), [], { live: ['orders', 'payouts'] });
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const toShip = useNotifyStore((s) => s.badges.orders);
  const refreshBadges = useNotifyStore((s) => s.refreshBadges);

  // A new order arrived (live notification): show it straight away.
  const seen = useRef(toShip);
  useEffect(() => {
    if (toShip > (seen.current ?? 0)) reload();
    seen.current = toShip;
  }, [toShip, reload]);

  async function mark(order, status) {
    setBusy(`${order.id}-${status}`);
    setActionError('');
    try {
      await unwrap(api.patch(`/orders/${order.id}/fulfilment`, { status }));
      setData((d) => ({ ...d, orders: d.orders.map((o) => (o.id === order.id ? { ...o, status } : o)) }));
      refreshBadges();
    } catch (err) {
      setActionError(apiError(err).message);
    } finally {
      setBusy('');
    }
  }

  const orders = data?.orders ?? [];
  const earned = orders.filter((o) => o.payout?.status === 'completed').reduce((n, o) => n + o.payout.amount, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Orders</h1>
          <p className="mt-1 text-muted">Paid orders. Call the buyer to arrange delivery, then mark it shipped and delivered.</p>
        </div>
        {orders.length > 0 && (
          <Card className="px-4 py-2.5">
            <p className="text-xs font-medium uppercase tracking-[0.04em] text-muted">Paid to you</p>
            <p className="font-display text-xl font-bold text-navy">{kes(earned)}</p>
          </Card>
        )}
      </div>
      <FormError message={actionError} />

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="mt-6 text-danger">{error.message}</p>
      ) : !orders.length ? (
        <Card className="mt-6 px-6 py-12 text-center">
          <Receipt className="mx-auto size-8 text-muted" aria-hidden />
          <p className="mt-3 font-semibold text-ink">No orders yet</p>
          <p className="mt-1 text-sm text-muted">When shoppers pay in your live room, their orders appear here — with a pop-up so you don't miss them.</p>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o) => {
            const payout = PAYOUT_LABEL[o.payout?.status];
            return (
              <li key={o.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted">
                      <span className="font-semibold text-ink">{o.orderNumber}</span> · {timeAgo(o.paidAt ?? o.createdAt)}
                      {o.receipt && ` · M-Pesa ${o.receipt}`}
                    </p>
                    <StatusPill status={o.status}>{ORDER_LABEL[o.status] ?? o.status}</StatusPill>
                  </div>

                  <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      {o.items.map((i) => (
                        <div key={i.product} className="flex items-center gap-3">
                          <ProductImage src={i.image} alt="" w={120} className="size-12 shrink-0 rounded-btn" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{i.name}</p>
                            <p className="text-sm text-muted">
                              {i.quantity} × {i.variant ? `· ${i.variant}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div className="rounded-btn bg-bg-soft p-3 text-sm">
                        <p className="font-semibold text-ink">
                          <Truck className="mr-1 inline size-4 text-navy" aria-hidden /> {o.delivery.name}
                        </p>
                        <p className="text-ink">{o.delivery.location}</p>
                        <a href={`tel:+${o.delivery.phone}`} className="inline-flex items-center gap-1 font-medium text-navy hover:underline">
                          <Phone className="size-3.5" aria-hidden /> 0{o.delivery.phone.slice(3)}
                        </a>
                        {o.delivery.notes && <p className="mt-1 text-muted">“{o.delivery.notes}”</p>}
                        <p className="mt-1 text-xs text-muted">Bought by {o.buyer.name}</p>
                      </div>
                    </div>

                    <dl className="min-w-48 space-y-1 text-sm sm:text-right">
                      <div className="flex justify-between gap-4 sm:block">
                        <dt className="text-muted">Sale</dt>
                        <dd className="font-semibold text-ink">{kes(o.amount)}</dd>
                      </div>
                      {o.commissionAmount != null && (
                        <div className="flex justify-between gap-4 sm:block">
                          <dt className="text-muted">Meet2buy {o.commissionRate}%</dt>
                          <dd className="text-ink">− {kes(o.commissionAmount)}</dd>
                        </div>
                      )}
                      {o.payoutFee > 0 && (
                        <div className="flex justify-between gap-4 sm:block">
                          <dt className="text-muted">M-Pesa fee</dt>
                          <dd className="text-ink">− {kes(o.payoutFee)}</dd>
                        </div>
                      )}
                      {o.payoutAmount != null && (
                        <div className="flex justify-between gap-4 border-t border-line pt-1 sm:block">
                          <dt className="text-muted">You get</dt>
                          <dd className="font-display text-lg font-bold text-navy">{kes(o.payoutAmount)}</dd>
                        </div>
                      )}
                      {payout && <p className={`text-xs font-medium ${payout[1]}`}>{payout[0]}</p>}
                      {o.status === 'on_hold' && <p className="text-xs font-medium text-danger">On hold: Meet2buy is checking this payment. Don't send yet.</p>}
                    </dl>
                  </div>

                  {['paid', 'shipped', 'delivered'].includes(o.status) && (
                    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
                      <Link
                        to={`/receipt/${o.id}`}
                        className="mr-auto inline-flex h-9 items-center gap-1.5 rounded-btn px-2 text-sm font-semibold text-navy hover:bg-navy-soft"
                      >
                        <FileText className="size-4" aria-hidden /> Receipt{o.receiptNumber ? ` ${o.receiptNumber}` : ''}
                      </Link>
                      {o.status === 'paid' && (
                        <Button size="sm" variant="outline" onClick={() => mark(o, 'shipped')} loading={busy === `${o.id}-shipped`}>
                          Mark shipped
                        </Button>
                      )}
                      {o.status !== 'delivered' && (
                        <Button size="sm" variant="primary" onClick={() => mark(o, 'delivered')} loading={busy === `${o.id}-delivered`}>
                          Mark delivered
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
