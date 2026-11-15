import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Select, Textarea } from '../../components/ui/Field.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StatusPill } from '../../components/ui/StatusPill.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { ORDER_LABEL } from '../account/MyOrders.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { kes, timeAgo } from '../../utils/format.js';

const HOLD_REASON = {
  amount_mismatch: 'The amount paid did not match the order',
  late_payment: 'Payment arrived after the order was cancelled',
  unconfirmed_payment: 'M-Pesa says paid, but the receipt never arrived',
  payout_too_small: 'Payout would be KES 0 after commission',
};

function ResolveDialog({ order, onClose, onDone }) {
  const [action, setAction] = useState('pay');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await unwrap(api.post(`/admin/orders/${order.id}/resolve`, { action, note }));
      onDone();
      onClose();
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(order)} onClose={onClose} title={`Resolve ${order?.orderNumber ?? ''}`}>
      {order && (
        <form onSubmit={submit} className="space-y-4">
          <p className="rounded-btn bg-[#FFF4D6] px-3 py-2 text-sm text-[#8A6100]">{HOLD_REASON[order.holdReason] ?? order.holdReason}</p>
          <dl className="grid grid-cols-2 gap-1 text-sm">
            <dt className="text-muted">Order total</dt>
            <dd className="font-semibold">{kes(order.amount)}</dd>
            <dt className="text-muted">M-Pesa says paid</dt>
            <dd className="font-semibold">{order.payment?.paidAmount != null ? kes(order.payment.paidAmount) : '—'}</dd>
            <dt className="text-muted">Receipt</dt>
            <dd className="font-semibold">{order.payment?.receipt ?? '—'}</dd>
          </dl>
          <p className="text-sm text-muted">Check the Paybill statement on the M-Pesa portal before choosing.</p>
          <Select label="What to do" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="pay">Payment is fine — mark paid and pay the seller</option>
            <option value="cancel">Cancel the order (refund the buyer from the M-Pesa portal)</option>
          </Select>
          <Textarea label="Note (what you checked)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} required />
          <FormError message={error} />
          <Button type="submit" variant={action === 'pay' ? 'primary' : 'danger'} className="w-full" loading={busy}>
            {action === 'pay' ? 'Mark paid & pay seller' : 'Cancel order'}
          </Button>
        </form>
      )}
    </Dialog>
  );
}

// Admin: every order with payment and payout (doc 02 §3 Transactions).
export function AdminTransactions() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const [q, setQ] = useState(params.get('q') ?? '');
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const qs = new URLSearchParams(Object.entries({ status, q: params.get('q') ?? '', from, to }).filter(([, v]) => v)).toString();
  const { data, loading, error, reload } = useFetch(() => api.get(`/admin/transactions?${qs}`), [qs]);
  const [resolving, setResolving] = useState(null);

  const setParam = (k, v) =>
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-[28px] font-bold">Transactions</h1>
      <p className="mt-1 text-muted">Every order with its M-Pesa payment and the seller's payout.</p>

      <Card className="mt-6 grid gap-3 p-4 sm:grid-cols-4">
        <Select label="Status" value={status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="">All</option>
          <option value="sold">Sold (paid, shipped, delivered)</option>
          <option value="on_hold">On hold</option>
          <option value="awaiting_payment">Awaiting payment</option>
          <option value="payment_failed">Payment failed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Input label="From" type="date" value={from} onChange={(e) => setParam('from', e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setParam('to', e.target.value)} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', q.trim());
          }}
        >
          <Input label="Order number" value={q} onChange={(e) => setQ(e.target.value)} placeholder="M2B-…" />
          <button type="submit" className="sr-only">
            <Search /> Search
          </button>
        </form>
      </Card>

      {data && (
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span>
            Sales: <strong className="text-navy">{kes(data.totals.sales)}</strong>
          </span>
          <span>
            Commission: <strong className="text-orange-ink">{kes(data.totals.commission)}</strong>
          </span>
          <span className="text-muted">{data.orders.length} orders shown (latest 200)</span>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="mt-6 text-danger">{error.message}</p>
      ) : !data.orders.length ? (
        <Card className="mt-4 px-6 py-10 text-center text-muted">No orders match.</Card>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-line bg-bg-soft text-xs uppercase tracking-[0.04em] text-muted">
              <tr>
                <th className="px-3 py-2.5">Order</th>
                <th className="px-3 py-2.5">Shop · buyer</th>
                <th className="px-3 py-2.5">Item</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-right">Commission</th>
                <th className="px-3 py-2.5 text-right">Seller gets</th>
                <th className="px-3 py-2.5">M-Pesa</th>
                <th className="px-3 py-2.5">Payout</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.orders.map((o) => (
                <tr key={o.id} className="align-top">
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-ink">{o.orderNumber}</p>
                    <p className="text-xs text-muted">{timeAgo(o.createdAt)}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink">{o.store?.name}</p>
                    <p className="text-xs text-muted">{o.buyer?.name}</p>
                  </td>
                  <td className="px-3 py-2.5 text-ink">
                    {o.items.map((i) => (
                      <p key={i.name}>
                        {i.quantity} × {i.name}
                      </p>
                    ))}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">{kes(o.amount)}</td>
                  <td className="px-3 py-2.5 text-right text-orange-ink">
                    {o.commissionAmount != null ? `${kes(o.commissionAmount)} (${o.commissionRate}%)` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">{o.payoutAmount != null ? kes(o.payoutAmount) : '—'}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{o.payment?.receipt ?? '—'}</p>
                    <p className="text-xs text-muted">{o.payment?.status}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    {o.payout ? (
                      <>
                        <StatusPill status={o.payout.status === 'completed' ? 'paid' : o.payout.status} >{o.payout.status}</StatusPill>
                        {o.payout.transactionId && <p className="mt-0.5 text-xs text-muted">{o.payout.transactionId}</p>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={o.status}>{ORDER_LABEL[o.status] ?? o.status}</StatusPill>
                    {o.status === 'on_hold' && (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => setResolving(o)}>
                        Resolve
                      </Button>
                    )}
                    {o.adminNote && <p className="mt-1 max-w-40 text-xs text-muted">Note: {o.adminNote}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ResolveDialog order={resolving} onClose={() => setResolving(null)} onDone={reload} />
    </div>
  );
}
