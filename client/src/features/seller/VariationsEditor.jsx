import { useState } from 'react';
import { Layers, Plus, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';

const MAX_GROUPS = 3;
const MAX_SKUS = 60;
const SUGGESTIONS = ['Storage', 'Colour', 'RAM', 'Size', 'Capacity'];

/** Every combination of the option groups: [{ Storage: '128GB', Colour: 'Black' }, …] */
function combinations(groups) {
  const ready = groups.filter((g) => g.label.trim() && g.options.length);
  if (!ready.length) return [];
  return ready.reduce((acc, g) => acc.flatMap((combo) => g.options.map((o) => ({ ...combo, [g.label.trim()]: o }))), [{}]);
}

const keyOf = (groups, options) => groups.map((g) => options[g.label.trim()]).join('|');

/**
 * Rebuild the variation rows after the options change, keeping the price, stock and id of every
 * combination that still exists (so open orders can still return their stock).
 */
export function syncSkus(groups, skus, basePrice, baseStock) {
  const ready = groups.filter((g) => g.label.trim() && g.options.length);
  const old = new Map(skus.map((s) => [keyOf(ready, s.options), s]));
  return combinations(ready).map((options) => {
    const prev = old.get(keyOf(ready, options));
    return prev ? { ...prev, options } : { options, price: String(basePrice || ''), stock: String(baseStock ?? '0'), on: true };
  });
}

/** Form → API: only the combinations the seller stocks ("on"). */
export const variationsBody = (groups, skus) => {
  const variants = groups
    .filter((g) => g.label.trim() && g.options.length)
    .map((g) => ({ label: g.label.trim(), options: g.options }));
  const list = skus
    .filter((s) => s.on !== false)
    .map((s) => ({ ...(s.id ? { id: s.id } : {}), options: s.options, price: Number(s.price), stock: Number(s.stock) }));
  return { variants, skus: variants.length ? list : [] };
};

function ChoiceInput({ onAdd }) {
  const [text, setText] = useState('');
  const add = () => {
    const parts = text
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length) onAdd(parts);
    setText('');
  };
  return (
    <input
      className="h-9 min-w-32 flex-1 rounded-btn border border-line bg-white px-2.5 text-sm focus:border-navy focus:outline-none"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          add();
        }
      }}
      onBlur={add}
      placeholder="Type a choice, press Enter"
      aria-label="Add a choice"
    />
  );
}

const cell =
  'h-9 w-full rounded-btn border border-line bg-white px-2 text-sm text-ink focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/25';

/**
 * Seller: "This product comes in different versions". Option groups (up to 3) → a table of every
 * combination with its own price and stock; untick the ones you don't stock.
 */
export function VariationsEditor({ groups, skus, onChange, basePrice, baseStock, errors = {} }) {
  const set = (nextGroups, nextSkus) => onChange(nextGroups, nextSkus ?? syncSkus(nextGroups, skus, basePrice, baseStock));
  const updateGroup = (i, patch) => set(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const updateSku = (i, patch) => onChange(groups, skus.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const ready = groups.filter((g) => g.label.trim() && g.options.length);
  const tooMany = skus.length > MAX_SKUS;
  const fillAll = (k, v) => onChange(groups, skus.map((s) => ({ ...s, [k]: v })));

  if (!groups.length) {
    return (
      <button
        type="button"
        onClick={() => set([{ label: 'Storage', options: [] }])}
        className="flex w-full items-center gap-3 rounded-card border border-dashed border-line px-4 py-3 text-left hover:border-navy/50 hover:bg-navy-soft/40"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy-soft text-navy">
          <Layers className="size-4" aria-hidden />
        </span>
        <span>
          <span className="block text-sm font-semibold text-ink">Add variations</span>
          <span className="block text-sm text-muted">For different storage, colours or sizes, each with its own price and stock.</span>
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-card border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Layers className="size-4 text-navy" aria-hidden /> Variations
        </p>
        <button type="button" className="text-sm font-medium text-danger hover:underline" onClick={() => onChange([], [])}>
          Remove variations
        </button>
      </div>

      <ul className="space-y-3">
        {groups.map((g, i) => (
          <li key={i} className="rounded-btn bg-bg-soft p-3">
            <div className="flex items-center gap-2">
              <input
                className={`${cell} max-w-44 font-medium`}
                value={g.label}
                onChange={(e) => updateGroup(i, { label: e.target.value })}
                placeholder="Option, e.g. Colour"
                aria-label="Option name"
                list="variation-suggestions"
              />
              <button
                type="button"
                onClick={() => set(groups.filter((_, j) => j !== i))}
                className="ml-auto grid size-9 place-items-center rounded-btn text-danger hover:bg-[#FDE8E7]"
                aria-label={`Remove ${g.label || 'option'}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {g.options.map((o) => (
                <span key={o} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-sm font-medium text-navy ring-1 ring-line">
                  {o}
                  <button
                    type="button"
                    onClick={() => updateGroup(i, { options: g.options.filter((x) => x !== o) })}
                    className="rounded-full text-muted hover:text-danger"
                    aria-label={`Remove ${o}`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ))}
              <ChoiceInput
                onAdd={(parts) => {
                  const fresh = parts.filter((p) => !g.options.some((o) => o.toLowerCase() === p.toLowerCase()));
                  if (fresh.length) updateGroup(i, { options: [...g.options, ...fresh].slice(0, 20) });
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <datalist id="variation-suggestions">
        {SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {groups.length < MAX_GROUPS && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => set([...groups, { label: SUGGESTIONS.find((s) => !groups.some((g) => g.label === s)) ?? '', options: [] }])}
        >
          <Plus className="size-4" aria-hidden /> Add another option
        </Button>
      )}
      {errors.variants && <p className="text-sm text-danger">{errors.variants}</p>}

      {ready.length > 0 && skus.length > 0 && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink">
              {skus.filter((s) => s.on !== false).length} of {skus.length} combinations in stock
            </p>
            <p className="text-xs text-muted">Untick the ones you don't sell.</p>
          </div>
          {tooMany && <p className="mt-1 text-sm text-danger">That's {skus.length} combinations — at most {MAX_SKUS}. Remove some choices.</p>}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                  <th className="w-8 pb-1.5" />
                  <th className="pb-1.5">Variation</th>
                  <th className="w-32 pb-1.5">
                    Price (KES)
                    <button type="button" className="ml-1 normal-case tracking-normal text-navy hover:underline" onClick={() => fillAll('price', skus.find((s) => s.on !== false)?.price ?? '')}>
                      same
                    </button>
                  </th>
                  <th className="w-24 pb-1.5">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {skus.map((s, i) => {
                  const on = s.on !== false;
                  const err = errors[`skus.${i}.price`] || errors[`skus.${i}.stock`] || errors[`skus.${i}.options`];
                  return (
                    <tr key={keyOf(ready, s.options)} className={on ? '' : 'opacity-50'}>
                      <td className="py-1.5">
                        <input
                          type="checkbox"
                          className="size-4 accent-navy"
                          checked={on}
                          onChange={(e) => updateSku(i, { on: e.target.checked })}
                          aria-label={`Sell ${ready.map((g) => s.options[g.label.trim()]).join(' / ')}`}
                        />
                      </td>
                      <td className="py-1.5 pr-2 font-medium text-ink">
                        {ready.map((g) => s.options[g.label.trim()]).join(' / ')}
                        {err && <span className="block text-xs font-normal text-danger">{err}</span>}
                      </td>
                      <td className="py-1.5 pr-2">
                        <input className={cell} inputMode="numeric" value={s.price} disabled={!on} onChange={(e) => updateSku(i, { price: e.target.value.replace(/\D/g, '') })} aria-label="Price" />
                      </td>
                      <td className="py-1.5">
                        <input className={cell} inputMode="numeric" value={s.stock} disabled={!on} onChange={(e) => updateSku(i, { stock: e.target.value.replace(/\D/g, '') })} aria-label="Stock" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {errors.skus && <p className="mt-1 text-sm text-danger">{errors.skus}</p>}
        </div>
      )}
    </div>
  );
}

/** Product → form state: option groups and every combination (stocked ones "on", the rest off). */
export function variationsFromProduct(product) {
  const groups = (product?.variants ?? []).map((v) => ({ label: v.label, options: [...v.options] }));
  if (!groups.length) return { groups: [], skus: [] };
  const stocked = (product.skus ?? []).map((s) => ({ id: s.id, options: s.options, price: String(s.price), stock: String(s.stock), on: true }));
  const all = syncSkus(groups, stocked, product.price, 0);
  // Old products with options but no variations: every combination starts "on" at the product's price.
  return { groups, skus: stocked.length ? all.map((s) => (s.id ? s : { ...s, on: false })) : all };
}
