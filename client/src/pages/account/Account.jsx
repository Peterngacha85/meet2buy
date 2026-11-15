import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError } from '../../services/api.js';

const ROLE_LABEL = { buyer: 'Shopper', seller: 'Seller', admin: 'Admin' };

function Row({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
      <dt className="w-32 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="break-all font-medium text-ink">{value || '—'}</dd>
    </div>
  );
}

function DeleteAccountDialog({ open, onClose, hasPassword, isSeller, storeName }) {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [state, setState] = useState({ sending: false, error: '', field: '' });

  const close = () => {
    setValue('');
    setState({ sending: false, error: '', field: '' });
    onClose();
  };

  async function submit(e) {
    e.preventDefault();
    setState({ sending: true, error: '', field: '' });
    try {
      const clearSession = await deleteAccount(hasPassword ? { password: value } : { confirm: value.trim() });
      navigate('/', { replace: true });
      setTimeout(clearSession, 0); // after leaving the guarded /account route
    } catch (err) {
      const { message, fieldErrors } = apiError(err);
      const field = fieldErrors.password ?? fieldErrors.confirm ?? '';
      setState({ sending: false, error: field ? '' : message, field });
    }
  }

  return (
    <Dialog open={open} onClose={close} title="Delete your account?">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-3 rounded-card bg-[#FDE8E7] p-4 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold">This cannot be undone.</p>
            <p>
              Your account and your demonstration requests will be permanently deleted.
              {isSeller && (
                <>
                  {' '}
                  Your shop{storeName ? <strong> {storeName}</strong> : ''}, all its products and its demo requests will be
                  removed from the mall too.
                </>
              )}
            </p>
          </div>
        </div>
        <FormError message={state.error} />
        {hasPassword ? (
          <Input
            label="Enter your password to confirm"
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={state.field}
            required
          />
        ) : (
          <Input
            label="Type DELETE to confirm"
            autoComplete="off"
            autoCapitalize="characters"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={state.field}
            required
          />
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button type="button" variant="outline" className="sm:flex-1" onClick={close} disabled={state.sending}>
            Keep my account
          </Button>
          <Button
            type="submit"
            variant="danger"
            className="sm:flex-1"
            loading={state.sending}
            disabled={hasPassword ? !value : value.trim() !== 'DELETE'}
          >
            <Trash2 className="size-4" aria-hidden /> Delete forever
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** My account: details, and the option to permanently delete the account (any role). */
export function Account() {
  const { user, store } = useAuth();
  const me = useFetch(() => api.get('/auth/me'));
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;
  const isOwnerAdmin = user.isEnvOwner;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="text-[28px] font-extrabold">My account</h1>

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-bold">Your details</h2>
        <dl className="mt-2 divide-y divide-line">
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone} />
          <Row label="Account type" value={`${ROLE_LABEL[user.role] ?? user.role}${user.isGuest ? ' (guest)' : ''}`} />
          {store && <Row label="Shop" value={store.name} />}
        </dl>
      </Card>

      <Card className="mt-6 border-danger/30 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-danger">Delete account</h2>
        {isOwnerAdmin ? (
          <p className="mt-1 text-sm text-muted">
            This is the owner admin account. It is managed from the server settings (.env) and cannot be deleted here.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              Permanently delete your Meet2buy account
              {user.role === 'seller' ? ', your shop and all its products' : ''}. This cannot be undone.
            </p>
            <Button variant="danger" className="mt-4" onClick={() => setDeleting(true)} loading={me.loading}>
              {!me.loading && <Trash2 className="size-4" aria-hidden />} Delete my account
            </Button>
          </>
        )}
      </Card>

      {!isOwnerAdmin && (
        <DeleteAccountDialog
          open={deleting}
          onClose={() => setDeleting(false)}
          hasPassword={Boolean(me.data?.hasPassword)}
          isSeller={user.role === 'seller'}
          storeName={store?.name}
        />
      )}
    </div>
  );
}
