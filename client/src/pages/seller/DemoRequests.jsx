import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { ProductImage } from '../../features/mall/ProductCard.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { timeAgo } from '../../utils/format.js';

const TABS = [
  ['open', 'New'],
  ['seen', 'Seen'],
  ['closed', 'Done'],
];

export function DemoRequests() {
  const [tab, setTab] = useState('open');
  const { data, loading, error, setData } = useFetch(() => api.get(`/stores/mine/presentation-requests?status=${tab}`), [tab]);
  const [actionError, setActionError] = useState('');

  async function move(r, status) {
    setActionError('');
    try {
      await unwrap(api.patch(`/stores/mine/presentation-requests/${r.id}`, { status }));
      setData((d) => ({
        ...d,
        requests: d.requests.filter((x) => x.id !== r.id),
        openCount: d.openCount - (r.status === 'open' ? 1 : 0),
      }));
    } catch (err) {
      setActionError(apiError(err).message);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[28px] font-bold">Demo requests</h1>
      <p className="mt-1 text-muted">
        Shoppers who clicked “Ready to buy?” while your shop was closed. Show them these products when you next go live.
      </p>

      <div className="mt-6 flex gap-2">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === key ? 'bg-navy text-white' : 'bg-white text-navy ring-1 ring-line hover:ring-navy/40'
            }`}
          >
            {label}
            {key === 'open' && data?.openCount ? ` · ${data.openCount}` : ''}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <FormError message={actionError || error?.message} />
      </div>

      {loading ? (
        <Spinner />
      ) : !data?.requests.length ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center text-muted">
          <MessageSquareText className="size-6 text-navy" aria-hidden />
          No {TABS.find(([k]) => k === tab)[1].toLowerCase()} requests.
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.requests.map((r) => (
            <li key={r.id}>
              <Card className="flex gap-3 p-4">
                <ProductImage src={r.product?.images?.[0]} alt="" w={160} className="size-16 shrink-0 rounded-btn" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {r.buyer?.name ?? 'A shopper'} wants to see{' '}
                    <span className="text-navy">{r.product?.name ?? `something in ${r.departmentName ?? 'your shop'}`}</span>
                  </p>
                  {r.message && <p className="mt-1 text-sm text-ink">“{r.message}”</p>}
                  <p className="mt-1 text-xs text-muted">
                    {r.departmentName && `${r.departmentName} · `}
                    {timeAgo(r.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {r.status === 'open' && (
                    <Button size="sm" variant="outline" onClick={() => move(r, 'seen')}>
                      Seen
                    </Button>
                  )}
                  {r.status !== 'closed' && (
                    <Button size="sm" variant="ghost" onClick={() => move(r, 'closed')}>
                      Done
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
