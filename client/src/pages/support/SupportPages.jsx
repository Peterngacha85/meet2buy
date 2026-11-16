import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, Ban, Package, PackageX, RefreshCcw, ShieldCheck, Truck, Wrench } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Textarea } from '../../components/ui/Field.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { ProductImage } from '../../features/mall/ProductCard.jsx';
import { ImageList } from '../../features/seller/ImageUpload.jsx';
import { SupportThread, TicketList } from '../../features/support/Support.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { kes } from '../../utils/format.js';

const CATEGORIES = [
  { key: 'not_delivered', label: 'Not delivered', hint: 'It hasn’t arrived', icon: Truck },
  { key: 'faulty', label: 'Faulty / not working', hint: 'It doesn’t work properly', icon: AlertTriangle },
  { key: 'damaged', label: 'Arrived damaged', hint: 'Broken or scratched on arrival', icon: PackageX },
  { key: 'wrong_item', label: 'Wrong item', hint: 'Different model, colour or size', icon: Ban },
  { key: 'warranty', label: 'Warranty / repair', hint: 'It stopped working later', icon: Wrench },
  { key: 'refund_return', label: 'Return or refund', hint: 'You want to send it back', icon: RefreshCcw },
  { key: 'other', label: 'Something else', hint: 'Anything about this order', icon: Package },
];

const ACTIVE = ['open', 'in_progress', 'escalated'];

/** Buyer: /orders/:orderId/help — pick what went wrong, describe it, add photos. */
export function NewSupportRequest() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const orders = useFetch(() => api.get('/orders/mine'));
  const tickets = useFetch(() => api.get('/support/mine'));
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (orders.loading || tickets.loading) return <Spinner />;
  const order = orders.data?.orders.find((o) => o.id === orderId);
  const existing = tickets.data?.tickets.find((t) => t.order === orderId && ACTIVE.includes(t.status));
  if (existing) return <Navigate to={`/support/${existing.id}`} replace />;
  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <p className="font-semibold text-ink">Order not found</p>
        <Button to="/orders" variant="ghost" className="mt-4">
          My orders
        </Button>
      </div>
    );
  }
  const item = order.items[0];

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError('');
    try {
      const { ticket } = await unwrap(api.post('/support', { orderId, category, description, images }));
      navigate(`/support/${ticket.id}`, { replace: true });
    } catch (err) {
      const { message, fieldErrors } = apiError(err);
      if (fieldErrors.ticket) return navigate(`/support/${fieldErrors.ticket}`, { replace: true });
      setErrors(fieldErrors);
      setError(Object.keys(fieldErrors).length ? '' : message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <Link to="/orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> My orders
      </Link>
      <h1 className="mt-3 text-[28px] font-bold">Get help with this order</h1>
      <p className="mt-1 text-muted">Tell {order.store?.name ?? 'the seller'} what’s wrong. You’ll get a reference number and can follow every reply here.</p>

      <Card className="mt-5 flex items-center gap-3 p-3">
        <ProductImage src={item?.image} alt="" w={120} className="size-14 shrink-0 rounded-btn" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{item?.name}</p>
          <p className="text-sm text-muted">
            {order.orderNumber}
            {order.receiptNumber ? ` · ${order.receiptNumber}` : ''}
            {item?.variant ? ` · ${item.variant}` : ''}
          </p>
        </div>
        <p className="font-display font-bold text-navy">{kes(order.amount)}</p>
      </Card>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">What went wrong?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map(({ key, label, hint, icon: Icon }) => (
              <label
                key={key}
                className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 transition ${
                  category === key ? 'border-navy bg-navy-soft ring-1 ring-navy' : 'border-line bg-white hover:border-navy/40'
                }`}
              >
                <input type="radio" name="category" value={key} checked={category === key} onChange={() => setCategory(key)} className="sr-only" />
                <Icon className={`mt-0.5 size-5 shrink-0 ${category === key ? 'text-navy' : 'text-muted'}`} aria-hidden />
                <span>
                  <span className="block font-semibold text-ink">{label}</span>
                  <span className="block text-sm text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.category && <p className="mt-1.5 text-sm text-danger">{errors.category}</p>}
        </fieldset>

        <Textarea
          label="Describe the problem"
          rows={5}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          placeholder="What happened, when, and what you’d like (repair, replacement, refund…). For phones, include the IMEI if you can."
        />
        <ImageList value={images} onChange={setImages} max={4} kind="support" label="Photos (optional)" cover={false} />

        <FormError message={error} />
        <Button type="submit" className="w-full" loading={busy} disabled={!category}>
          Send to the seller
        </Button>
        <p className="flex items-start gap-2 text-xs text-muted">
          <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
          If you and the seller can’t agree, you can ask Meet2buy to step in from the request page.
        </p>
      </form>
    </div>
  );
}

/** One request, for whoever may see it. `back` is where the list lives for this viewer. */
export function SupportTicketPage({ back }) {
  const { id } = useParams();
  const { data, loading, error, setData } = useFetch(() => api.get(`/support/${id}`), [id], { live: ['support'] });
  return (
    <div className={back === '/support' ? 'mx-auto max-w-2xl px-4 py-8 sm:py-12' : 'mx-auto max-w-3xl'}>
      <Link to={back} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> All requests
      </Link>
      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-danger">{error.message}</p>
      ) : (
        <SupportThread ticket={data.ticket} onChange={(ticket) => setData({ ticket })} />
      )}
    </div>
  );
}

const FILTERS = [
  ['active', 'Active'],
  ['', 'All'],
  ['resolved', 'Resolved'],
  ['closed', 'Closed'],
];

function ListPage({ title, intro, endpoint, base, showStore, showBuyer, filters = FILTERS, wrap = true, defaultFilter = 'active', empty }) {
  const [status, setStatus] = useState(defaultFilter);
  const { data, loading, error } = useFetch(() => api.get(endpoint, { params: status ? { status } : {} }), [status], { live: ['support'] });
  return (
    <div className={wrap ? 'mx-auto max-w-3xl px-4 py-8 sm:py-12' : 'mx-auto max-w-4xl'}>
      <h1 className="text-[28px] font-bold">{title}</h1>
      <p className="mt-1 text-muted">{intro}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {filters.map(([key, label]) => (
          <button
            key={key || 'all'}
            onClick={() => setStatus(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${status === key ? 'bg-navy text-white' : 'bg-white text-navy ring-1 ring-line'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {loading ? (
          <Spinner />
        ) : error ? (
          <p className="text-danger">{error.message}</p>
        ) : (
          <TicketList tickets={data.tickets} base={base} showStore={showStore} showBuyer={showBuyer} empty={empty} />
        )}
      </div>
    </div>
  );
}

export function BuyerSupportList() {
  return (
    <ListPage
      title="Help requests"
      intro="After-sales requests you raised about your orders. To start a new one, open the order in My orders."
      endpoint="/support/mine"
      base="/support"
      showStore
      defaultFilter=""
      empty="No help requests. Problems with an order? Open it in My orders and choose “Get help”."
    />
  );
}

export function SellerSupportList() {
  return (
    <ListPage
      title="After-sales"
      intro="Buyers’ complaints, returns and warranty requests. Reply quickly and agree on a fair fix."
      endpoint="/support/store"
      base="/seller/support"
      showBuyer
      wrap={false}
      empty="No requests here. Happy customers!"
    />
  );
}

export function AdminSupportList() {
  return (
    <ListPage
      title="After-sales"
      intro="Every buyer request. Escalated ones are waiting for Meet2buy to step in."
      endpoint="/support"
      base="/admin/support"
      showStore
      showBuyer
      wrap={false}
      defaultFilter="escalated"
      filters={[['escalated', 'Escalated'], ...FILTERS]}
      empty="Nothing waiting for Meet2buy."
    />
  );
}
