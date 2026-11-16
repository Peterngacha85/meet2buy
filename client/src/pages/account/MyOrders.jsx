import { Link } from 'react-router';
import { FileText, LifeBuoy, Phone, Receipt } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StatusPill } from '../../components/ui/StatusPill.jsx';
import { ProductImage } from '../../features/mall/ProductCard.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api } from '../../services/api.js';
import { kes, timeAgo } from '../../utils/format.js';

export const ORDER_LABEL = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  payment_failed: 'Payment failed',
  on_hold: 'Being checked',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Doc 02 §2.4: status, shop and the seller's phone (shown once paid, to arrange delivery).
export function MyOrders() {
  const { data, loading, error } = useFetch(() => api.get('/orders/mine'), [], { live: ['orders', 'payouts', 'support'] });
  const orders = data?.orders ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">My orders</h1>
          <p className="mt-1 text-muted">What you bought in Meet2buy shops. The seller contacts you to arrange delivery.</p>
        </div>
        <Link to="/support" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
          <LifeBuoy className="size-4" aria-hidden /> Help requests
        </Link>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="mt-6 text-danger">{error.message}</p>
      ) : !orders.length ? (
        <Card className="mt-6 px-6 py-12 text-center">
          <Receipt className="mx-auto size-8 text-muted" aria-hidden />
          <p className="mt-3 font-semibold text-ink">No orders yet</p>
          <p className="mt-1 text-sm text-muted">Walk into a live shop, see the product demonstrated, and pay with M-Pesa.</p>
          <Link to="/" className="mt-4 inline-block font-semibold text-navy hover:underline">
            Go to the mall
          </Link>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted">
                    <span className="font-semibold text-ink">{o.orderNumber}</span> · {timeAgo(o.createdAt)}
                    {o.store && (
                      <>
                        {' · '}
                        <Link to={`/shop/${o.store.slug}`} className="font-medium text-navy hover:underline">
                          {o.store.name}
                        </Link>
                      </>
                    )}
                  </p>
                  <StatusPill status={o.status}>{ORDER_LABEL[o.status] ?? o.status}</StatusPill>
                </div>
                {o.items.map((i) => (
                  <div key={i.product} className="mt-3 flex items-center gap-3">
                    <ProductImage src={i.image} alt="" w={120} className="size-14 shrink-0 rounded-btn" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{i.name}</p>
                      <p className="text-sm text-muted">
                        {i.quantity} × {i.variant ? `· ${i.variant}` : ''}
                      </p>
                    </div>
                    <p className="font-display font-bold text-navy">{kes(o.amount)}</p>
                  </div>
                ))}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-sm text-muted">
                  {o.payment?.receipt && <span>M-Pesa receipt {o.payment.receipt}</span>}
                  <span>
                    Deliver to {o.delivery.name}, {o.delivery.location}
                  </span>
                  {o.store?.phone && (
                    <a href={`tel:+${o.store.phone}`} className="inline-flex items-center gap-1 font-medium text-navy hover:underline">
                      <Phone className="size-3.5" aria-hidden /> Seller: 0{o.store.phone.slice(3)}
                    </a>
                  )}
                  {o.status === 'on_hold' && <span>Meet2buy is checking this payment and will contact you.</span>}
                </div>
                {['paid', 'shipped', 'delivered'].includes(o.status) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to={`/receipt/${o.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-btn border border-navy px-3 text-sm font-semibold text-navy hover:bg-navy-soft">
                      <FileText className="size-4" aria-hidden /> Receipt{o.receiptNumber ? ` ${o.receiptNumber}` : ''}
                    </Link>
                    <Link to={`/orders/${o.id}/help`} className="inline-flex h-9 items-center gap-1.5 rounded-btn px-3 text-sm font-semibold text-navy hover:bg-navy-soft">
                      <LifeBuoy className="size-4" aria-hidden /> Get help with this order
                    </Link>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
