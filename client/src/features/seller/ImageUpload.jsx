import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { apiError } from '../../services/api.js';
import { imgUrl, uploadImage } from '../../services/uploads.js';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/heic';

function useUploader(kind, onUploaded) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onFiles(files) {
    setError('');
    setBusy(true);
    try {
      for (const file of files) onUploaded(await uploadImage(file, kind));
    } catch (err) {
      setError(err.response ? apiError(err).message : err.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const picker = (multiple = false) => (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      multiple={multiple}
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => e.target.files?.length && onFiles([...e.target.files])}
    />
  );
  return { input, busy, error, picker };
}

/** Single image (logo, banner): preview, replace, remove. */
export function ImageUpload({ label, hint, kind, value, onChange, aspect = 'aspect-square', fit = 'contain', className = '' }) {
  const { input, busy, error, picker } = useUploader(kind, onChange);

  return (
    <div className={className}>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      <div className={`relative overflow-hidden rounded-card border border-dashed border-line bg-white ${aspect}`}>
        {value ? (
          <img
            src={imgUrl(value, { w: 800 })}
            alt=""
            className={`size-full ${fit === 'cover' ? 'object-cover' : 'object-contain p-3'}`}
          />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-1.5 text-sm text-muted hover:bg-bg-soft"
          >
            <ImagePlus className="size-6 text-navy" aria-hidden />
            Upload
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-white/80">
            <Loader2 className="size-6 animate-spin text-navy" aria-label="Uploading" />
          </div>
        )}
      </div>
      {value && (
        <div className="mt-2 flex gap-3 text-sm">
          <button type="button" className="font-semibold text-navy hover:underline" onClick={() => input.current?.click()}>
            Replace
          </button>
          <button type="button" className="font-semibold text-danger hover:underline" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      )}
      {picker()}
      {error ? <p className="mt-1.5 text-sm text-danger">{error}</p> : hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
    </div>
  );
}

/** Up to `max` product photos. The first photo is the cover. */
export function ImageList({ value, onChange, max = 5, kind = 'product' }) {
  const { input, busy, error, picker } = useUploader(kind, (url) => onChange((list) => [...list, url].slice(0, max)));

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">
        Photos <span className="font-normal text-muted">({value.length}/{max}, first is the cover)</span>
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {value.map((src, i) => (
          <li key={src} className="group relative aspect-square overflow-hidden rounded-btn border border-line">
            <img src={imgUrl(src, { w: 240 })} alt={`Photo ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange((list) => list.filter((u) => u !== src))}
              className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-danger shadow"
              aria-label={`Remove photo ${i + 1}`}
            >
              <Trash2 className="size-3.5" />
            </button>
            {i === 0 && (
              <span className="absolute bottom-1 left-1 rounded bg-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>
            )}
          </li>
        ))}
        {value.length < max && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="grid aspect-square w-full place-items-center rounded-btn border border-dashed border-line text-navy hover:bg-bg-soft"
              aria-label="Add photos"
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            </button>
          </li>
        )}
      </ul>
      {picker(true)}
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
