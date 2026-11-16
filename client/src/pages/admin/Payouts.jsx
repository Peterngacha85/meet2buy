import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StatusPill } from '../../components/ui/StatusPill.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError } from '../../services/api.js';
import { kes, timeAgo } from '../../utils/format.js';

const TABS = [
  ['failed', 'Failed'],
  ['processing', 'Processing'],
  ['completed', 'Completed'],
  ['', 'All'],
];

// Admin: seller payouts (doc 08 §7 rules 3, 4, 8). Failed ones show Safaricom's reason and can be retried safely.
export function AdminPayouts() {
  const [tab, setTab] = useState('failed');
  const { data, loading, error, reload } = useFetch(() => api.get(`/admin/payouts${tab ? `?status=${tab}` : ''}`), [tab], { live: ['payouts', 'orders'] });
  const [busy, setBusy] = useState('');
  const [messages, setMessages] = useState({});

  async function retry(p) {
    setBusy(p.id);
    try {
      const res = await api.post(`/admin/payouts/${p.id}/retry`);
      const d = res.data.data;
      setMessages((m) => ({ ...m, [p.id]: d.checking ? { tone: 'text-navy', text: d.message } : { tone: 'text-success', text: `Sent again — ${d.payout.status}` } }));
      if (!d.checking) reload();
    } catch (err) {
      setMessages((m) => ({ ...m, [p.id]: { tone: 'text-danger', text: apiError(err).message } }));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[28px] font-bold">Payouts</h1>
      <p className="mt-1 text-muted">Money sent to sellers by M-Pesa B2B straight after each sale.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <button
            key={label}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-navy text-white' : 'bg-white text-navy ring-1 ring-line hover:ring-navy/40'}`}
          >
            {label}
            {key && data?.counts?.[key] ? ` · ${data.counts[key]}` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="mt-6 text-danger">{error.message}</p>
      ) : !data.payouts.length ? (
        <Card className="mt-4 px-6 py-10 text-center text-muted">{tab === 'failed' ? 'No failed payouts. 🎉' : 'Nothing here.'}</Card>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.payouts.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">
                      {kes(p.amount)} → {p.store?.name}
                    </p>
                    <StatusPill status={p.status === 'completed' ? 'paid' : p.status}>{p.status}</StatusPill>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {p.destinationType === 'till' ? 'Till' : 'Paybill'} {p.destination}
                    {p.destinationType === 'paybill' && ` · account ${p.accountReference}`} · order {p.order?.orderNumber} · {timeAgo(p.createdAt)} ·{' '}
                    {p.attempts} attempt{p.attempts === 1 ? '' : 's'}
                  </p>
                  {p.transactionId && <p className="text-sm text-success">M-Pesa ref {p.transactionId}</p>}
                  {p.resultDesc && p.status !== 'completed' && <p className="mt-1 text-sm text-danger">Safaricom: {p.resultDesc}</p>}
                  {p.timedOutAt && p.status === 'processing' && (
                    <p className="mt-1 text-sm text-[#8A6100]">Safaricom's queue timed out — a status check was requested.</p>
                  )}
                  {messages[p.id] && <p className={`mt-1 text-sm ${messages[p.id].tone}`}>{messages[p.id].text}</p>}
                </div>
                {p.status === 'failed' && (
                  <Button size="sm" variant="primary" onClick={() => retry(p)} loading={busy === p.id} className="shrink-0">
                    {busy !== p.id && <RotateCw className="size-4" aria-hidden />} Retry
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted">
        Retrying first asks M-Pesa whether the last attempt really failed, so a seller is never paid twice. It always uses the seller's current
        verified payout number.
      </p>
    </div>
  );
}
