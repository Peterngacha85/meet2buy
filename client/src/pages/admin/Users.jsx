import { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Select } from '../../components/ui/Field.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StatusPill } from '../../components/ui/StatusPill.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { timeAgo } from '../../utils/format.js';

// Admin: find any account and suspend abusive users (doc 02 §3 Users).
export function AdminUsers() {
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const qs = new URLSearchParams(Object.entries({ q: search, role }).filter(([, v]) => v)).toString();
  const { data, loading, error, setData } = useFetch(() => api.get(`/admin/users?${qs}`), [qs]);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');

  async function toggle(u) {
    setBusy(u.id);
    setActionError('');
    try {
      const { user } = await unwrap(api.patch(`/admin/users/${u.id}/suspend`, { suspended: u.status === 'active' }));
      setData((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, status: user.status } : x)) }));
    } catch (err) {
      setActionError(apiError(err).message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[28px] font-bold">Users</h1>
      <p className="mt-1 text-muted">Suspending logs the person out everywhere and blocks them from logging in. To close a shop, use Sellers.</p>

      <Card className="mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_200px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
          }}
        >
          <Input label="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setSearch(q.trim())} />
        </form>
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Everyone</option>
          <option value="buyer">Shoppers</option>
          <option value="seller">Sellers</option>
          <option value="admin">Admins</option>
        </Select>
      </Card>
      {actionError && <p className="mt-3 text-sm text-danger">{actionError}</p>}

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="mt-6 text-danger">{error.message}</p>
      ) : !data.users.length ? (
        <Card className="mt-4 px-6 py-10 text-center text-muted">No one matches.</Card>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-bg-soft text-xs uppercase tracking-[0.04em] text-muted">
              <tr>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Contact</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5">Orders</th>
                <th className="px-3 py-2.5">Joined</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2.5 font-medium text-ink">
                    {u.name}
                    {u.isGuest && <span className="ml-1.5 text-xs text-muted">(guest)</span>}
                    {u.isEnvOwner && <span className="ml-1.5 text-xs text-orange-ink">(owner)</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted">
                    <p>{u.email ?? '—'}</p>
                    {u.phone && <p>{u.phone}</p>}
                  </td>
                  <td className="px-3 py-2.5 capitalize">{u.role === 'buyer' ? 'shopper' : u.role}</td>
                  <td className="px-3 py-2.5">{u.orders}</td>
                  <td className="px-3 py-2.5 text-muted">{timeAgo(u.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={u.status === 'active' ? 'approved' : 'suspended'}>{u.status}</StatusPill>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!u.isEnvOwner && u.id !== me?.id && (
                      <Button size="sm" variant={u.status === 'active' ? 'outline' : 'primary'} onClick={() => toggle(u)} loading={busy === u.id}>
                        {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
