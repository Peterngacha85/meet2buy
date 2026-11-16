import { useState } from 'react';
import { Check, Copy, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { timeAgo } from '../../utils/format.js';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked: the text is selectable */
        }
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function AddAdminDialog({ open, onClose, onAdded }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { admin, created, tempPassword }

  const reset = () => {
    setEmail('');
    setName('');
    setNeedsName(false);
    setErrors({});
    setError('');
    setResult(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError('');
    try {
      const data = await unwrap(api.post('/admin/admins', { email, ...(name.trim() ? { name: name.trim() } : {}) }));
      setResult(data);
      onAdded();
    } catch (err) {
      const { message, fieldErrors } = apiError(err);
      if (fieldErrors.name) setNeedsName(true); // no account with this email yet: ask for a name
      setErrors(fieldErrors);
      setError(fieldErrors.name ? '' : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} title={result ? 'Admin added' : 'Add an admin'}>
      {result ? (
        <div className="space-y-4">
          <p className="text-ink">
            <strong>{result.admin.name}</strong> ({result.admin.email}) is now a Meet2buy admin.
          </p>
          {result.created ? (
            <div className="rounded-card border border-orange/40 bg-orange-soft p-4">
              <p className="text-sm font-semibold text-ink">Temporary password — shown only once</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 select-all rounded-btn bg-white px-3 py-2 font-mono text-base tracking-wide text-navy">{result.tempPassword}</code>
                <CopyButton text={result.tempPassword} />
              </div>
              <p className="mt-2 text-sm text-ink">
                Send it to them privately. They log in with their email and this password, then change it on their Account page.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">They already had an account, so they log in as before and now see the admin dashboard.</p>
          )}
          <Button className="w-full" onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted">
            Admins can approve and suspend shops, watch and close live rooms, resolve orders, retry payouts and change commission. Only add
            people you trust.
          </p>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required autoFocus />
          {needsName && (
            <Input
              label="Their name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              hint="No Meet2buy account uses this email yet, so one will be created with a temporary password."
              required
              autoFocus
            />
          )}
          <FormError message={error} />
          <Button type="submit" className="w-full" loading={busy}>
            <UserPlus className="size-4" aria-hidden /> {needsName ? 'Create admin account' : 'Add admin'}
          </Button>
        </form>
      )}
    </Dialog>
  );
}

// Admin: who can run Meet2buy (doc 06 /admin/admins).
export function AdminAdmins() {
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/admins'), [], { live: ['users'] });
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  async function remove() {
    setBusy(true);
    setActionError('');
    try {
      await unwrap(api.delete(`/admin/admins/${removing.id}`));
      setRemoving(null);
      reload();
    } catch (err) {
      setActionError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Admins</h1>
          <p className="mt-1 text-muted">People who can run the Meet2buy dashboard.</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <UserPlus className="size-4" aria-hidden /> Add admin
        </Button>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="mt-6 text-danger">{error.message}</p>
      ) : (
        <Card className="mt-6 divide-y divide-line">
          {data.admins.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-navy-soft text-navy">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">
                  {a.name}
                  {a.isYou && <span className="ml-2 text-xs font-medium text-muted">(you)</span>}
                  {a.isEnvOwner && <span className="ml-2 rounded-full bg-orange-soft px-2 py-0.5 text-xs font-semibold text-orange-ink">Owner</span>}
                  {a.status !== 'active' && <span className="ml-2 text-xs font-semibold text-danger">suspended</span>}
                </p>
                <p className="truncate text-sm text-muted">
                  {a.email} · admin since {timeAgo(a.createdAt)}
                </p>
              </div>
              {!a.isEnvOwner && !a.isYou && (
                <Button size="sm" variant="ghost" onClick={() => setRemoving(a)}>
                  Remove
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}
      <p className="mt-4 text-xs text-muted">
        The owner admin comes from ADMIN_EMAIL / ADMIN_PASSWORD in the server settings and can only be changed there.
      </p>

      <AddAdminDialog open={adding} onClose={() => setAdding(false)} onAdded={reload} />
      <Dialog open={Boolean(removing)} onClose={() => setRemoving(null)} title={`Remove ${removing?.name ?? ''}?`}>
        <p className="text-muted">
          They lose access to the admin dashboard straight away. Their account stays, as a normal shopper account.
        </p>
        <FormError message={actionError} />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemoving(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={remove} loading={busy}>
            Remove admin access
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
