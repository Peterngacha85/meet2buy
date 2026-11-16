import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { kes } from '../../utils/format.js';

/** The band a unit price falls into (same rule as the server's tierFor). */
export function tierFor(tiers, price) {
  return tiers.find((t) => price >= Number(t.min) && (t.max === '' || t.max == null || price <= Number(t.max))) ?? null;
}

/** Form rows (strings) → API body (numbers, null = no upper limit). */
export const tiersBody = (tiers) =>
  tiers.map((t) => ({
    name: t.name.trim(),
    min: Number(t.min),
    max: t.max === '' || t.max == null ? null : Number(t.max),
    rate: Number(t.rate),
  }));

const cell =
  'h-10 w-full rounded-btn border border-line bg-white px-2.5 text-[15px] text-ink focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/25';

/**
 * Admin: commission by selling price. One row per band: name, from, to (empty = and above), rate.
 * `errors` uses the server's paths: "commissionTiers.2.max".
 */
export function CommissionTiersEditor({ value, onChange, errors = {} }) {
  const update = (i, k) => (e) => onChange(value.map((t, j) => (j === i ? { ...t, [k]: e.target.value } : t)));
  const remove = (i) => onChange(value.filter((_, j) => j !== i));
  const add = () => {
    const last = value[value.length - 1];
    const from = last?.max ? Number(last.max) + 1 : '';
    onChange([...value, { name: '', min: String(from), max: '', rate: '' }]);
  };
  const rowError = (i) =>
    ['name', 'min', 'max', 'rate'].map((k) => errors[`commissionTiers.${i}.${k}`]).find(Boolean);

  return (
    <div>
      <div className="hidden grid-cols-[1.4fr_1fr_1fr_0.7fr_auto] gap-2 px-1 pb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted sm:grid">
        <span>Category</span>
        <span>From (KES)</span>
        <span>To (KES)</span>
        <span>Rate %</span>
        <span className="w-9" />
      </div>
      <ul className="space-y-3 sm:space-y-2">
        {value.map((t, i) => (
          <li key={i} className="rounded-card border border-line p-3 sm:border-0 sm:p-0">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_1fr_0.7fr_auto] sm:items-center">
              <input aria-label="Category name" className={`${cell} col-span-2 sm:col-span-1`} value={t.name} onChange={update(i, 'name')} placeholder="e.g. Mid-range" />
              <input aria-label="From price" className={cell} inputMode="numeric" value={t.min} onChange={update(i, 'min')} placeholder="From" />
              <input aria-label="To price" className={cell} inputMode="numeric" value={t.max ?? ''} onChange={update(i, 'max')} placeholder="and above" />
              <input aria-label="Rate percent" className={cell} inputMode="decimal" value={t.rate} onChange={update(i, 'rate')} placeholder="%" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="grid size-10 place-items-center justify-self-end rounded-btn text-danger hover:bg-[#FDE8E7]"
                aria-label={`Remove ${t.name || 'band'}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            {rowError(i) && <p className="mt-1 text-sm text-danger">{rowError(i)}</p>}
          </li>
        ))}
      </ul>
      {errors.commissionTiers && <p className="mt-2 text-sm text-danger">{errors.commissionTiers}</p>}
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={add} disabled={value.length >= 10}>
        <Plus className="size-4" aria-hidden /> Add price band
      </Button>
    </div>
  );
}

/** "A KES 25,000 sale → Mid-range, 3%: Meet2buy keeps KES 750, seller gets …" */
export function CommissionPreview({ tiers, defaultRate, fee, price, onPrice }) {
  const p = Number(price) || 0;
  const band = tierFor(tiers, p);
  const rate = band ? Number(band.rate) : Number(defaultRate || 0);
  const commission = Math.round((p * rate) / 100);
  return (
    <div className="rounded-btn bg-bg-soft px-3 py-3 text-sm text-ink">
      <label className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Try a price:</span>
        <span className="text-muted">KES</span>
        <input
          className="h-9 w-32 rounded-btn border border-line bg-white px-2.5 focus:border-navy focus:outline-none"
          inputMode="numeric"
          value={price}
          onChange={(e) => onPrice(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <p className="mt-2">
        {band ? (
          <>
            <strong>{band.name || 'Unnamed band'}</strong> · {rate}%
          </>
        ) : (
          <>Outside every band → default {rate}%</>
        )}
        : Meet2buy keeps {kes(commission)}
        {fee ? `, B2B fee ${kes(fee)}` : ''}, seller gets <strong>{kes(Math.max(0, p - commission - fee))}</strong>.
      </p>
    </div>
  );
}
