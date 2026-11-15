import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { kes } from '../../utils/format.js';

// Admin settings (doc 08 §4): commission, who pays the M-Pesa B2B fee, offer and counter timers.
export function AdminSettings() {
  const { data, loading, error } = useFetch(() => api.get('/admin/settings'));
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(data.settings);
  }, [data]);

  if (loading || !form) return error ? <p className="text-danger">{error.message}</p> : <Spinner />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const example = 2500;
  const commission = Math.round((example * Number(form.defaultCommissionRate || 0)) / 100);
  const fee = form.deductPayoutFeeFromSeller ? Number(form.payoutFee || 0) : 0;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage('');
    setFailure('');
    try {
      const { settings } = await unwrap(
        api.patch('/admin/settings', {
          defaultCommissionRate: Number(form.defaultCommissionRate),
          deductPayoutFeeFromSeller: form.deductPayoutFeeFromSeller,
          payoutFee: Number(form.payoutFee),
          offerExpiryMinutes: Number(form.offerExpiryMinutes),
          counterTimeLimitMinutes: Number(form.counterTimeLimitMinutes),
        }),
      );
      setForm(settings);
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
          <h2 className="text-lg font-bold">Commission</h2>
          <Input
            label="Default commission (%)"
            type="number"
            step="0.5"
            min="0"
            max="50"
            value={form.defaultCommissionRate}
            onChange={set('defaultCommissionRate')}
            error={errors.defaultCommissionRate}
            hint="Shops with their own rate (set in Sellers) use that instead."
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
          <p className="rounded-btn bg-bg-soft px-3 py-2 text-sm text-ink">
            Example: a {kes(example)} sale → Meet2buy keeps {kes(commission)}
            {fee ? `, fee ${kes(fee)}` : ''}, seller gets <strong>{kes(example - commission - fee)}</strong>.
          </p>
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
