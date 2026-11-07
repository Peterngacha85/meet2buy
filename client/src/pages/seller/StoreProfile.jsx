import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Field.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { SignBoard } from '../../features/mall/ShopSign.jsx';
import { DepartmentEditor, withKeys } from '../../features/seller/DepartmentEditor.jsx';
import { ImageUpload } from '../../features/seller/ImageUpload.jsx';
import { useMyStore } from '../../features/seller/useMyStore.js';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError } from '../../services/api.js';

const SIGN_COLOURS = ['#0B1F5C', '#111827', '#1C2B8C', '#0E5AA7', '#007C7A', '#1F6F50', '#9E1B3A', '#B3261E', '#4A2C82', '#8A6A00'];

export function StoreProfile() {
  const { store, save } = useMyStore();
  const wings = useFetch(() => api.get('/stores/wings'));
  const [form, setForm] = useState(() => ({
    name: store.name,
    description: store.description,
    logo: store.logo,
    banner: store.banner,
    brandColor: store.brandColor,
    departments: withKeys(store.departments),
  }));
  const [state, setState] = useState({ saving: false, saved: false, error: '', fields: {} });
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setState((s) => ({ ...s, saved: false }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    setState({ saving: true, saved: false, error: '', fields: {} });
    try {
      const updated = await save('', {
        ...form,
        departments: form.departments.map(({ id, name, wing }) => ({ ...(id ? { id } : {}), name, wing })),
      });
      setForm((f) => ({ ...f, departments: withKeys(updated.departments) }));
      setState({ saving: false, saved: true, error: '', fields: {} });
    } catch (err) {
      const { message, fieldErrors } = apiError(err);
      setState({ saving: false, saved: false, error: message, fields: fieldErrors });
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Shop profile</h1>
          <p className="mt-1 text-muted">Your sign, your departments and how your shop looks in the mall.</p>
        </div>
        <div className="flex items-center gap-3">
          {state.saved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" aria-hidden /> Saved
            </span>
          )}
          <Button type="submit" loading={state.saving}>
            Save changes
          </Button>
        </div>
      </div>
      <div className="mt-4">
        <FormError message={state.error} />
      </div>

      <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="text-lg font-bold">About your shop</h2>
            <Input label="Shop name" value={form.name} onChange={(e) => set({ name: e.target.value })} error={state.fields.name} />
            <Textarea
              label="Description"
              rows={3}
              maxLength={500}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              error={state.fields.description}
            />
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold">Departments</h2>
            <p className="mb-4 text-sm text-muted">
              Shoppers walk into a department, see its product line-up, then ask for a demonstration. A department with
              products cannot be removed until its products are moved.
            </p>
            {wings.loading ? (
              <Spinner />
            ) : (
              <DepartmentEditor
                wings={wings.data?.wings ?? []}
                value={form.departments}
                onChange={(departments) => set({ departments })}
                error={state.fields.departments}
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="text-lg font-bold">Shop sign</h2>
            <div className="overflow-hidden rounded-card border border-line">
              <SignBoard store={{ ...store, ...form }} />
            </div>
            <ImageUpload
              label="Logo"
              hint="PNG with a transparent background works best."
              kind="logo"
              aspect="aspect-[16/7]"
              value={form.logo}
              onChange={(logo) => set({ logo })}
            />
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Sign colour</p>
              <div className="flex flex-wrap items-center gap-2">
                {SIGN_COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set({ brandColor: c })}
                    className={`size-8 rounded-full ring-offset-2 ${form.brandColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-navy' : ''}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Colour ${c}`}
                  />
                ))}
                <label className="relative size-8 cursor-pointer overflow-hidden rounded-full border border-line" title="Your brand colour">
                  <input
                    type="color"
                    value={form.brandColor}
                    onChange={(e) => set({ brandColor: e.target.value.toUpperCase() })}
                    className="absolute -inset-2 size-12 cursor-pointer"
                    aria-label="Custom colour"
                  />
                </label>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <ImageUpload
              label="Shop banner (optional)"
              hint="Wide photo of your shop or products, about 1600 × 480."
              kind="banner"
              aspect="aspect-[10/3]"
              fit="cover"
              value={form.banner}
              onChange={(banner) => set({ banner })}
            />
          </Card>
        </div>
      </div>
    </form>
  );
}
