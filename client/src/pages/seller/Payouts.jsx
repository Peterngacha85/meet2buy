import { useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { PayoutFields, emptyPayout, payoutBody } from '../../features/seller/PayoutFields.jsx';
import { useMyStore } from '../../features/seller/useMyStore.js';
import { apiError } from '../../services/api.js';

export function SellerPayouts() {
  const { store, save } = useMyStore();
  const [payout, setPayout] = useState({ ...emptyPayout, ...store.payout });
  const [state, setState] = useState({ saving: false, saved: false, error: '', fields: {} });

  async function onSubmit(e) {
    e.preventDefault();
    setState({ saving: true, saved: false, error: '', fields: {} });
    try {
      const updated = await save('/payout', payoutBody(payout));
      setPayout({ ...emptyPayout, ...updated.payout });
      setState({ saving: false, saved: true, error: '', fields: {} });
    } catch (err) {
      const { message, fieldErrors } = apiError(err);
      setState({ saving: false, saved: false, error: Object.keys(fieldErrors).length ? '' : message, fields: fieldErrors });
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[28px] font-bold">Payout settings</h1>
      <p className="mt-1 text-muted">When a buyer pays, Meet2buy keeps its commission and sends the rest here straight away.</p>

      <Card className="mt-6 p-5">
        <p className={`mb-5 flex items-center gap-2 text-sm font-medium ${store.payout?.verified ? 'text-success' : 'text-[#8A6100]'}`}>
          <ShieldCheck className="size-4" aria-hidden />
          {store.payout?.verified ? 'Verified by Meet2buy' : 'Waiting for Meet2buy to verify these details'}
        </p>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError message={state.error} />
          <PayoutFields value={payout} onChange={setPayout} errors={state.fields} />
          <p className="text-sm text-muted">Changing these details means Meet2buy has to verify them again.</p>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={state.saving}>
              Save payout details
            </Button>
            {state.saved && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckCircle2 className="size-4" aria-hidden /> Saved
              </span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
