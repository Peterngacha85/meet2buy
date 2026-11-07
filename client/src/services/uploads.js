import { api, unwrap } from './api.js';

export const MAX_UPLOAD_MB = 8;

/**
 * Upload one image straight to Cloudinary with a signature from our API.
 * kind: 'logo' | 'banner' | 'product' | 'avatar'. Returns the secure https URL.
 */
export async function uploadImage(file, kind) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG, PNG or WebP).');
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`Images must be under ${MAX_UPLOAD_MB} MB.`);

  const { uploadUrl, apiKey, params, signature } = await unwrap(api.post('/uploads/signature', { kind }));
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('signature', signature);
  for (const [key, value] of Object.entries(params)) form.append(key, String(value));

  const res = await fetch(uploadUrl, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? 'Upload failed. Please try again.');
  return body.secure_url;
}

/**
 * Cloudinary delivery URL resized for display: auto format (WebP/AVIF) and quality.
 * imgUrl(url, { w: 400 }) or imgUrl(url, { w: 1600, h: 400, fill: true })
 */
export function imgUrl(url, { w, h, fill = false } = {}) {
  if (!url || !url.includes('/image/upload/')) return url;
  const t = ['f_auto', 'q_auto', w && `w_${w}`, h && `h_${h}`, fill ? 'c_fill,g_auto' : 'c_limit', 'dpr_auto']
    .filter(Boolean)
    .join(',');
  return url.replace('/image/upload/', `/image/upload/${t}/`);
}
