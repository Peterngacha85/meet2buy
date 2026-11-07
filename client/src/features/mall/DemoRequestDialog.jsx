import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { CheckCircle2 } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Select, Textarea } from '../../components/ui/Field.jsx';
import { FormError } from '../../pages/auth/AuthCard.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { api, apiError } from '../../services/api.js';

/**
 * "Ready to buy? Click for a demonstration by a salesperson."
 * While the shop is closed this saves a demo request for the seller (doc 02 §2.2).
 * Sprint 4: when the shop is live, the same button takes the buyer into the room and queue.
 */
export function DemoRequestDialog({ open, onClose, store, department, products, product }) {
  const { user, store: myStore } = useAuth();
  const location = useLocation();
  const [productId, setProductId] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState({ sending: false, sent: false, error: '' });

  useEffect(() => {
    if (open) {
      setProductId(product?.id ?? '');
      setMessage('');
      setState({ sending: false, sent: false, error: '' });
    }
  }, [open, product]);

  const ownShop = Boolean(myStore && myStore.id === store.id);

  async function submit(e) {
    e.preventDefault();
    setState({ sending: true, sent: false, error: '' });
    try {
      await api.post(`/stores/${store.id}/presentation-requests`, {
        product: productId || null,
        department: department?.id ?? null,
        message,
      });
      setState({ sending: false, sent: true, error: '' });
    } catch (err) {
      setState({ sending: false, sent: false, error: apiError(err).message });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={state.sent ? 'Request sent' : 'Get a live demonstration'}>
      {state.sent ? (
        <div className="space-y-4">
          <p className="flex gap-3 text-ink">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <span>
              A salesperson at <strong>{store.name}</strong> will see your request and show you the product live when the
              shop opens.
            </span>
          </p>
          <Button onClick={onClose} className="w-full">
            Back to the shop
          </Button>
        </div>
      ) : !user ? (
        <div className="space-y-4">
          <p className="text-muted">
            Log in so the salesperson at <strong className="text-ink">{store.name}</strong> knows who to call to the counter.
          </p>
          <Button to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} className="w-full">
            Log in to continue
          </Button>
          <p className="text-center text-sm text-muted">
            New here?{' '}
            <a href="/register" className="font-semibold text-navy hover:underline">
              Create a free account
            </a>
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted">
            {store.name} is closed right now. Tell the salesperson what you want to see and they will demonstrate it when the
            shop goes live.
          </p>
          <FormError message={state.error || (ownShop ? 'This is your own shop.' : '')} />
          <Select label="Product" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Anything in {department?.name ?? store.name}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Textarea
            label="Your question (optional)"
            placeholder="e.g. Does it come with a warranty? Can you show the back?"
            maxLength={300}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button type="submit" variant="accent" className="w-full" loading={state.sending} disabled={ownShop}>
            Request a demonstration
          </Button>
        </form>
      )}
    </Dialog>
  );
}
