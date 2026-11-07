import { useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Select, Textarea } from '../../components/ui/Field.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { FormError } from '../auth/AuthCard.jsx';
import { ProductImage } from '../../features/mall/ProductCard.jsx';
import { ImageList } from '../../features/seller/ImageUpload.jsx';
import { useMyStore } from '../../features/seller/useMyStore.js';
import { useFetch } from '../../hooks/useFetch.js';
import { api, apiError, unwrap } from '../../services/api.js';
import { kes } from '../../utils/format.js';

const blank = (department) => ({ name: '', department, price: '', stock: '1', description: '', images: [], isVisible: true });

function ProductForm({ open, onClose, product, departments, defaultDepartment, onSaved }) {
  const [form, setForm] = useState(blank(defaultDepartment));
  const [state, setState] = useState({ saving: false, error: '', fields: {} });
  const [lastOpen, setLastOpen] = useState(false);

  // Reset the form each time the dialog opens.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setForm(
        product
          ? { ...product, price: String(product.price), stock: String(product.stock), description: product.description ?? '' }
          : blank(defaultDepartment),
      );
      setState({ saving: false, error: '', fields: {} });
    }
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setState({ saving: true, error: '', fields: {} });
    const body = {
      name: form.name,
      department: form.department,
      price: form.price,
      stock: form.stock,
      description: form.description,
      images: form.images,
      isVisible: form.isVisible,
    };
    try {
      const { product: saved } = await unwrap(product ? api.patch(`/products/${product.id}`, body) : api.post('/products', body));
      onSaved(saved, Boolean(product));
      onClose();
    } catch (err) {
      const { message, fieldErrors } = apiError(err);
      setState({ saving: false, error: Object.keys(fieldErrors).length ? '' : message, fields: fieldErrors });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={product ? 'Edit product' : 'Add a product'} wide>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={state.error} />
        <ImageList value={form.images} onChange={(fn) => setForm((f) => ({ ...f, images: fn(f.images) }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Product name" value={form.name} onChange={set('name')} error={state.fields.name} />
          <Select label="Department" value={form.department} onChange={set('department')} error={state.fields.department}>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Input label="Price (KES)" inputMode="numeric" value={form.price} onChange={set('price')} error={state.fields.price} />
          <Input label="In stock" inputMode="numeric" value={form.stock} onChange={set('stock')} error={state.fields.stock} />
        </div>
        <Textarea label="Description" rows={4} maxLength={2000} value={form.description} onChange={set('description')} error={state.fields.description} />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.isVisible}
            onChange={(e) => setForm((f) => ({ ...f, isVisible: e.target.checked }))}
            className="size-4 accent-navy"
          />
          Show this product in my shop
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={state.saving}>
            {product ? 'Save product' : 'Add product'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function SellerProducts() {
  const { store } = useMyStore();
  const { data, loading, error, setData } = useFetch(() => api.get('/products/mine'));
  const [dept, setDept] = useState(store.departments[0]?.id ?? '');
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [actionError, setActionError] = useState('');

  const products = data?.products ?? [];
  const shown = products.filter((p) => p.department === dept);
  const replace = (saved, existed) =>
    setData((d) => ({ products: existed ? d.products.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...d.products] }));

  async function toggleVisible(p) {
    setActionError('');
    try {
      const { product } = await unwrap(api.patch(`/products/${p.id}`, { isVisible: !p.isVisible }));
      replace(product, true);
    } catch (err) {
      setActionError(apiError(err).message);
    }
  }

  async function remove(p) {
    if (!window.confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
    setActionError('');
    try {
      await api.delete(`/products/${p.id}`);
      setData((d) => ({ products: d.products.filter((x) => x.id !== p.id) }));
    } catch (err) {
      setActionError(apiError(err).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold">Products</h1>
          <p className="mt-1 text-muted">The line-up shoppers see in each department.</p>
        </div>
        <Button onClick={() => setEditing('new')} disabled={!store.departments.length}>
          <Plus className="size-4" aria-hidden /> Add product
        </Button>
      </div>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {store.departments.map((d) => (
          <button
            key={d.id}
            onClick={() => setDept(d.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
              d.id === dept ? 'bg-navy text-white' : 'bg-white text-navy ring-1 ring-line hover:ring-navy/40'
            }`}
          >
            {d.name} <span className={d.id === dept ? 'text-white/70' : 'text-muted'}>· {products.filter((p) => p.department === d.id).length}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <FormError message={actionError || error?.message} />
      </div>

      {loading ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <Card className="mt-2 px-6 py-12 text-center">
          <p className="font-semibold text-ink">No products in this department yet</p>
          <p className="mt-1 text-sm text-muted">Add the products you want to demonstrate to shoppers.</p>
          <Button className="mt-4" variant="outline" onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden /> Add product
          </Button>
        </Card>
      ) : (
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {shown.map((p) => (
            <li key={p.id}>
              <Card className={`flex gap-3 p-3 ${p.isVisible ? '' : 'opacity-70'}`}>
                <ProductImage src={p.images[0]} alt={p.name} w={200} className="size-20 shrink-0 rounded-btn" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{p.name}</p>
                  <p className="font-display font-bold text-navy">{kes(p.price)}</p>
                  <p className={`text-xs ${p.stock ? 'text-muted' : 'text-danger'}`}>
                    {p.stock ? `${p.stock} in stock` : 'Out of stock'}
                    {!p.isVisible && ' · Hidden'}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditing(p)} className="rounded-btn p-2 text-navy hover:bg-navy-soft" aria-label={`Edit ${p.name}`}>
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => toggleVisible(p)}
                    className="rounded-btn p-2 text-navy hover:bg-navy-soft"
                    aria-label={p.isVisible ? `Hide ${p.name}` : `Show ${p.name}`}
                  >
                    {p.isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                  <button onClick={() => remove(p)} className="rounded-btn p-2 text-danger hover:bg-[#FDE8E7]" aria-label={`Delete ${p.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ProductForm
        open={editing !== null}
        onClose={() => setEditing(null)}
        product={editing === 'new' ? null : editing}
        departments={store.departments}
        defaultDepartment={dept}
        onSaved={(saved, existed) => {
          replace(saved, existed);
          setDept(saved.department);
        }}
      />
    </div>
  );
}
