import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { CommissionPreview, CommissionTiersEditor, tiersBody } from '../../features/admin/CommissionTiers.jsx';

const toRows = (tiers) => tiers.map((t) => ({ name: t.name, min: String(t.min), max: t.max == null ? '' : String(t.max), rate: String(t.rate) }));

// Admin settings (doc 08 §4): commission, who pays the M-Pesa B2B fee, offer and counter timers.
export function AdminSettings() {
  const { data, loading, error } = useFetch(() => api.get('/admin/settings'));
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [tryPrice, setTryPrice] = useState('25000');

  useEffect(() => {
    if (data) setForm({ ...data.settings, commissionTiers: toRows(data.settings.commissionTiers ?? []) });
  }, [data]);

  if (loading || !form) return error ? <p className="text-danger">{error.message}</p> : <Spinner />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const fee = form.deductPayoutFeeFromSeller ? Number(form.payoutFee || 0) : 0;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage('');
    setFailure('');
    // Sorted like the server sorts them, so error paths (commissionTiers.2.max) point at the right row.
    const rows = [...form.commissionTiers].sort((a, b) => Number(a.min) - Number(b.min));
    setForm((f) => ({ ...f, commissionTiers: rows }));
    try {
      const { settings } = await unwrap(
        api.patch('/admin/settings', {
          defaultCommissionRate: Number(form.defaultCommissionRate),
          commissionTiers: tiersBody(rows),
          deductPayoutFeeFromSeller: form.deductPayoutFeeFromSeller,
          payoutFee: Number(form.payoutFee),
          offerExpiryMinutes: Number(form.offerExpiryMinutes),
          counterTimeLimitMinutes: Number(form.counterTimeLimitMinutes),
        }),
      );
      setForm({ ...settings, commissionTiers: toRows(settings.commissionTiers) });
      setMessage('Saved. New orders use these settings; past orders keep the commission they were sold with.');
    } catch (err) {
      const { message: m, fieldErrors } = apiError(err);
      setErrors(fieldErrors);
      setFailure(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[28px] font-bold">Settings</h1>
      <form onSubmit={save} className="mt-6 space-y-6">
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-bold">Commission by selling price</h2>
            <p className="mt-1 text-sm text-muted">
              The rate is picked from the price of the item sold (one phone, not the whole order). A shop with its own rate (set in
              Sellers) uses that instead.
            </p>
          </div>
          <CommissionTiersEditor
            value={form.commissionTiers}
            onChange={(commissionTiers) => setForm((f) => ({ ...f, commissionTiers }))}
            errors={errors}
          />
          <Input
            label="Default commission (%) — prices outside every band"
            type="number"
            step="0.5"
            min="0"
            max="50"
            value={form.defaultCommissionRate}
            onChange={set('defaultCommissionRate')}
            error={errors.defaultCommissionRate}
            hint="E.g. accessories under the lowest band."
          />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 size-4 accent-navy" checked={form.deductPayoutFeeFromSeller} onChange={set('deductPayoutFeeFromSeller')} />
            <span>
              <span className="font-medium text-ink">Take Safaricom's B2B fee from the seller's payout</span>
              <span className="block text-muted">Off: Meet2buy pays the fee out of its commission.</span>
            </span>
          </label>
          {form.deductPayoutFeeFromSeller && (
            <Input label="B2B fee per payout (KES)" type="number" min="0" step="1" value={form.payoutFee} onChange={set('payoutFee')} error={errors.payoutFee} />
          )}
          <CommissionPreview
            tiers={form.commissionTiers}
            defaultRate={form.defaultCommissionRate}
            fee={fee}
            price={tryPrice}
            onPrice={setTryPrice}
          />
        </Card>

        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="text-lg font-bold sm:col-span-2">Live room</h2>
          <Input label="Offers expire after (minutes)" type="number" min="1" max="120" value={form.offerExpiryMinutes} onChange={set('offerExpiryMinutes')} error={errors.offerExpiryMinutes} />
          <Input
            label="Counter time per buyer (minutes)"
            type="number"
            min="1"
            max="60"
            value={form.counterTimeLimitMinutes}
            onChange={set('counterTimeLimitMinutes')}
            error={errors.counterTimeLimitMinutes}
            hint="The seller sees “Time's up” — nobody is cut off."
          />
        </Card>

        <FormError message={failure} />
        {message && <p className="rounded-btn bg-[#E6F4EA] px-3.5 py-2.5 text-sm text-success">{message}</p>}
        <Button type="submit" loading={busy}>
          Save settings
        </Button>
      </form>
    </div>
  );
}
