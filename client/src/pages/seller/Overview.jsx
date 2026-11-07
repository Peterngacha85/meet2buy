import { useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Circle, Clock, ExternalLink, ShieldAlert, Store } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { StatusPill } from '../../components/ui/StatusPill.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { SignBoard } from '../../features/mall/ShopSign.jsx';
import { useMyStore } from '../../features/seller/useMyStore.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError } from '../../services/api.js';

function StatusCard({ store }) {
  const { save } = useMyStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const content = {
    pending: {
      icon: Clock,
      tone: 'bg-[#FFF4D6] text-[#8A6100]',
      title: 'Your shop is under review',
      text: 'Meet2buy checks your details and payout number before your shop opens in the mall. Use this time to add your logo and products.',
    },
    approved: {
      icon: Store,
      tone: 'bg-[#E6F4EA] text-success',
      title: 'Your shop is open in the mall',
      text: 'Shoppers can walk in, browse your departments and ask for a live demonstration.',
    },
    rejected: {
      icon: ShieldAlert,
      tone: 'bg-[#FDE8E7] text-danger',
      title: 'Your shop needs changes',
      text: store.rejectionReason ? `Meet2buy says: “${store.rejectionReason}”` : 'Update your details, then send it for review again.',
    },
    suspended: {
      icon: ShieldAlert,
      tone: 'bg-[#FDE8E7] text-danger',
      title: 'Your shop is suspended',
      text: `${store.rejectionReason ? `Reason: ${store.rejectionReason}. ` : ''}Contact Meet2buy support to reopen it.`,
    },
  }[store.status];
  const Icon = content.icon;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${content.tone}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">{content.title}</h2>
          <StatusPill status={store.status} />
        </div>
        <p className="mt-1 text-sm text-muted">{content.text}</p>
        <FormError message={error} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button to={`/shop/${store.slug}`} variant="outline" size="sm">
            <ExternalLink className="size-4" aria-hidden /> {store.status === 'approved' ? 'View my shop' : 'Preview my shop'}
          </Button>
          {store.status === 'rejected' && (
            <Button
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await save('/resubmit', {}, 'post');
                } catch (err) {
                  setError(apiError(err).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send for review again
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function SellerOverview() {
  const { user } = useAuth();
  const { store } = useMyStore();
  const products = useFetch(() => api.get('/products/mine'));
  const requests = useFetch(() => api.get('/stores/mine/presentation-requests?status=open'));

  if (!store) return null;

  const productCount = products.data?.products.length ?? 0;
  const steps = [
    { done: Boolean(store.logo), label: 'Upload your logo for your shop sign', to: '/seller/store' },
    { done: store.departments.length > 0, label: 'Set up your departments', to: '/seller/store' },
    { done: productCount > 0, label: 'Add products to your line-up', to: '/seller/products' },
    { done: store.payout?.verified, label: 'Payout number verified by Meet2buy', to: '/seller/payouts' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-[28px] font-bold">Hi, {user.name.split(' ')[0]}</h1>
        <p className="mt-1 text-muted">{store.name} · your shop dashboard</p>
      </div>

      <StatusCard store={store} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          <h2 className="text-lg font-bold">Get your shop ready</h2>
          <ul className="mt-3 divide-y divide-line">
            {steps.map((s) => (
              <li key={s.label}>
                <Link to={s.to} className="flex items-center gap-3 py-3 text-sm hover:text-navy">
                  {s.done ? (
                    <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done" />
                  ) : (
                    <Circle className="size-5 shrink-0 text-line" aria-label="To do" />
                  )}
                  <span className={s.done ? 'text-muted line-through' : 'font-medium text-ink'}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <SignBoard store={store} />
            <p className="px-4 py-3 text-xs text-muted">Your shop sign in the mall</p>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.04em] text-muted">Products</p>
              <p className="mt-1 font-display text-2xl font-bold text-navy">{products.loading ? '…' : productCount}</p>
            </Card>
            <Link to="/seller/requests">
              <Card className="h-full p-4 hover:border-navy">
                <p className="text-xs font-medium uppercase tracking-[0.04em] text-muted">Demo requests</p>
                <p className="mt-1 font-display text-2xl font-bold text-navy">{requests.loading ? '…' : requests.data?.openCount ?? 0}</p>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
