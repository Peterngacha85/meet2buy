import { Link } from 'react-router';
import { AlertTriangle, ArrowRight, FlaskConical } from 'lucide-react';
import { Card } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api } from '../../services/api.js';
import { kes } from '../../utils/format.js';

function Stat({ label, value, to, tone = 'text-navy' }) {
  const body = (
    <Card className={`h-full p-5 ${to ? 'transition hover:border-navy/40' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-[0.04em] text-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${tone}`}>{value}</p>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export function AdminOverview() {
  const { data, loading, error } = useFetch(() => api.get('/admin/stats'));
  if (loading) return <Spinner />;
  if (error) return <p className="text-danger">{error.message}</p>;
  const s = data.stats;

  const attention = [
    s.pending > 0 && { text: `${s.pending} shop${s.pending === 1 ? '' : 's'} waiting for review`, to: '/admin/sellers' },
    s.failedPayouts > 0 && { text: `${s.failedPayouts} failed payout${s.failedPayouts === 1 ? '' : 's'} — sellers are waiting for money`, to: '/admin/payouts' },
    s.onHold > 0 && { text: `${s.onHold} order${s.onHold === 1 ? '' : 's'} on hold — check the M-Pesa statement`, to: '/admin/transactions?status=on_hold' },
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[28px] font-bold">Overview</h1>
      <p className="mt-1 text-muted">Meet2buy today (Nairobi time).</p>

      {data.simulated && (
        <p className="mt-4 flex items-start gap-2 rounded-btn border border-dashed border-orange bg-orange-soft px-3.5 py-2.5 text-sm text-ink">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-orange-ink" aria-hidden />
          M-Pesa is in test mode (MPESA_SIMULATE). Payments and payouts here are simulated — no real money moved.
        </p>
      )}

      {attention.length > 0 && (
        <Card className="mt-4 divide-y divide-line border-danger/30">
          {attention.map((a) => (
            <Link key={a.to} to={a.to} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-bg-soft">
              <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
              <span className="flex-1 font-medium text-ink">{a.text}</span>
              <ArrowRight className="size-4 text-muted" aria-hidden />
            </Link>
          ))}
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Sales today" value={kes(s.today.sales)} to="/admin/transactions?status=sold" />
        <Stat label="Commission today" value={kes(s.today.commission)} tone="text-orange-ink" />
        <Stat label="Orders today" value={s.today.orders} to="/admin/transactions" />
        <Stat label="Sales this month" value={kes(s.month.sales)} />
        <Stat label="Commission this month" value={kes(s.month.commission)} tone="text-orange-ink" />
        <Stat label="Live rooms now" value={s.live} to="/admin/live-rooms" />
        <Stat label="Open shops" value={s.sellers} to="/admin/sellers" />
        <Stat label="Pending approvals" value={s.pending} to="/admin/sellers" tone={s.pending ? 'text-danger' : 'text-navy'} />
        <Stat label="Shoppers" value={s.buyers} to="/admin/users" />
      </div>
    </div>
  );
}
