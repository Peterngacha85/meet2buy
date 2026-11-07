import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';

const key = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));

/** Give API departments a stable React key: [{ id, name, wing }] → [{ _k, id, name, wing }] */
export const withKeys = (departments = []) => departments.map((d) => ({ ...d, _k: d.id ?? key() }));

/**
 * Pick the shop's departments, wing by wing. Each wing suggests common departments
 * (e.g. Home Appliances → TVs, Cookers, Fridges); sellers can add their own and rename any.
 */
export function DepartmentEditor({ wings, value, onChange, error }) {
  const [custom, setCustom] = useState({});

  const has = (wing, name) => value.find((d) => d.wing === wing && d.name.toLowerCase() === name.toLowerCase());
  const add = (wing, name) => {
    const clean = name.trim();
    if (!clean || has(wing, clean)) return;
    onChange([...value, { _k: key(), name: clean, wing }]);
  };
  const remove = (k) => onChange(value.filter((d) => d._k !== k));
  const rename = (k, name) => onChange(value.map((d) => (d._k === k ? { ...d, name } : d)));

  return (
    <div className="space-y-4">
      {wings.map((w) => {
        const mine = value.filter((d) => d.wing === w.slug);
        const suggestions = w.departments.filter((name) => !has(w.slug, name));
        return (
          <fieldset key={w.slug} className="rounded-card border border-line bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-navy">{w.name} wing</legend>

            {mine.length > 0 && (
              <ul className="mb-3 space-y-2">
                {mine.map((d) => (
                  <li key={d._k} className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-success" aria-hidden />
                    <input
                      value={d.name}
                      onChange={(e) => rename(d._k, e.target.value)}
                      maxLength={40}
                      aria-label="Department name"
                      className="h-9 min-w-0 flex-1 rounded-btn border border-line px-3 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/25"
                    />
                    <button
                      type="button"
                      onClick={() => remove(d._k)}
                      className="rounded-btn p-1.5 text-muted hover:bg-bg-soft hover:text-danger"
                      aria-label={`Remove ${d.name}`}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => add(w.slug, name)}
                    className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-navy hover:border-navy hover:bg-navy-soft"
                  >
                    <Plus className="size-3.5" aria-hidden /> {name}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <input
                value={custom[w.slug] ?? ''}
                onChange={(e) => setCustom((c) => ({ ...c, [w.slug]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add(w.slug, custom[w.slug] ?? '');
                    setCustom((c) => ({ ...c, [w.slug]: '' }));
                  }
                }}
                maxLength={40}
                placeholder="Another department…"
                aria-label={`Add a department in ${w.name}`}
                className="h-9 min-w-0 flex-1 rounded-btn border border-line px-3 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/25"
              />
              <button
                type="button"
                onClick={() => {
                  add(w.slug, custom[w.slug] ?? '');
                  setCustom((c) => ({ ...c, [w.slug]: '' }));
                }}
                className="rounded-btn border border-navy px-3 text-sm font-semibold text-navy hover:bg-navy-soft"
              >
                Add
              </button>
            </div>
          </fieldset>
        );
      })}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
