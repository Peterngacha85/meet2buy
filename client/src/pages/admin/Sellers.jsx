import { useState } from 'react';
import { ExternalLink, Mail, Phone } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Textarea } from '../../components/ui/Field.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StatusPill } from '../../components/ui/StatusPill.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { SignBoard } from '../../features/mall/ShopSign.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { timeAgo } from '../../utils/format.js';

const TABS = [
  ['pending', 'Waiting for review'],
  ['approved', 'Open'],
  ['rejected', 'Rejected'],
  ['suspended', 'Suspended'],
];

function PayoutDetails({ payout }) {
  if (!payout) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted">Payout</dt>
      <dd className="font-medium text-ink">
        {payout.type === 'till' ? `Till ${payout.tillNumber}` : `Paybill ${payout.paybillNumber} · Acc ${payout.accountNumber}`}
      </dd>
      <dt className="text-muted">Name on M-Pesa</dt>
      <dd className="font-medium text-ink">{payout.registeredName}</dd>
      <dt className="text-muted">Verified</dt>
      <dd className={payout.verified ? 'font-medium text-success' : 'font-medium text-[#8A6100]'}>{payout.verified ? 'Yes' : 'Not yet'}</dd>
    </dl>
  );
}

function SellerRow({ seller, onChanged }) {
  const [mode, setMode] = useState(null); // 'reject' | 'suspend'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(action, body) {
    setBusy(true);
    setError('');
    try {
      const { seller: updated } = await unwrap(api.patch(`/admin/sellers/${seller.id}/${action}`, body));
      onChanged(updated);
    } catch (err) {
      setError(apiError(err).message);
      setBusy(false);
    }
  }

  const needsReverify = seller.status === 'approved' && !seller.payout?.verified;

  return (
    <Card className="grid gap-5 p-4 sm:p-5 md:grid-cols-[220px_1fr]">
      <div className="overflow-hidden rounded-btn border border-line">
        <SignBoard store={seller} />
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">{seller.name}</h2>
          <StatusPill status={seller.status} />
          <span className="text-xs text-muted">Registered {timeAgo(seller.createdAt)}</span>
        </div>
        {seller.description && <p className="text-sm text-muted">{seller.description}</p>}
        <p className="text-sm">
          <span className="text-muted">Departments: </span>
          <span className="font-medium text-ink">{seller.departments.map((d) => d.name).join(', ')}</span>
          <span className="text-muted"> · {seller.productCount} products · {seller.logo ? 'logo uploaded' : 'no logo yet'}</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {seller.ownerInfo && (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-ink">{seller.ownerInfo.name}</p>
              <p className="flex items-center gap-1.5 text-muted">
                <Mail className="size-3.5" aria-hidden /> {seller.ownerInfo.email}
              </p>
              <p className="flex items-center gap-1.5 text-muted">
                <Phone className="size-3.5" aria-hidden /> {seller.ownerInfo.phone}
              </p>
            </div>
          )}
          <PayoutDetails payout={seller.payout} />
        </div>
        {seller.rejectionReason && (
          <p className="text-sm">
            <span className="text-muted">Reason given: </span>
            {seller.rejectionReason}
          </p>
        )}

        <FormError message={error} />

        {mode ? (
          <div className="space-y-2">
            <Textarea
              label={mode === 'reject' ? 'What should the seller fix?' : 'Reason for suspending (optional)'}
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="danger" loading={busy} onClick={() => act(mode, { reason })}>
                {mode === 'reject' ? 'Reject shop' : 'Suspend shop'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(seller.status === 'pending' || seller.status === 'rejected' || needsReverify) && (
              <Button size="sm" loading={busy} onClick={() => act('approve')}>
                {needsReverify ? 'Verify new payout details' : 'Approve and verify payout'}
              </Button>
            )}
            {seller.status === 'pending' && (
              <Button size="sm" variant="outline" onClick={() => setMode('reject')}>
                Reject
              </Button>
            )}
            {seller.status === 'approved' && (
              <Button size="sm" variant="outline" onClick={() => setMode('suspend')}>
                Suspend
              </Button>
            )}
            {seller.status === 'suspended' && (
              <Button size="sm" loading={busy} onClick={() => act('reinstate')}>
                Reinstate
              </Button>
            )}
            <Button size="sm" variant="ghost" to={`/shop/${seller.slug}`} target="_blank">
              <ExternalLink className="size-4" aria-hidden /> Preview shop
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function AdminSellers() {
  const [tab, setTab] = useState('pending');
  const { data, loading, error, reload } = useFetch(() => api.get(`/admin/sellers?status=${tab}`), [tab]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[28px] font-bold">Sellers</h1>
      <p className="mt-1 text-muted">Approve shops before they open in the mall. Approving also verifies the payout number.</p>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
              tab === key ? 'bg-navy text-white' : 'bg-white text-navy ring-1 ring-line hover:ring-navy/40'
            }`}
          >
            {label}
            {data?.counts?.[key] ? <span className={tab === key ? 'text-white/70' : 'text-muted'}> · {data.counts[key]}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <FormError message={error?.message} />
      </div>

      {loading ? (
        <Spinner />
      ) : !data?.sellers.length ? (
        <Card className="px-6 py-12 text-center text-muted">No shops here.</Card>
      ) : (
        <ul className="space-y-4">
          {data.sellers.map((s) => (
            <li key={s.id}>
              <SellerRow seller={s} onChanged={reload} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
