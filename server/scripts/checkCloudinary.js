// Checks the Cloudinary keys in .env end to end: signs an upload exactly like
// POST /api/uploads/signature, uploads a 1×1 PNG, then deletes it.
// Usage: npm run check:cloudinary
import { env } from '../src/config/env.js';
import { createUploadSignature, isCloudinaryConfigured, signParams } from '../src/services/cloudinary.js';

if (!isCloudinaryConfigured()) {
  console.error('Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env');
  process.exit(1);
}

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const { uploadUrl, apiKey, params, signature } = createUploadSignature('avatar');
const form = new FormData();
form.append('file', new Blob([PIXEL], { type: 'image/png' }), 'check.png');
form.append('api_key', apiKey);
form.append('signature', signature);
for (const [k, v] of Object.entries(params)) form.append(k, String(v));

const up = await fetch(uploadUrl, { method: 'POST', body: form });
const uploaded = await up.json();
if (!up.ok) {
  console.error('Upload failed:', uploaded.error?.message ?? up.status);
  process.exit(1);
}
console.log('Signed upload OK:', uploaded.secure_url);

const del = { public_id: uploaded.public_id, timestamp: Math.floor(Date.now() / 1000) };
const delForm = new FormData();
for (const [k, v] of Object.entries(del)) delForm.append(k, String(v));
delForm.append('api_key', env.CLOUDINARY_API_KEY);
delForm.append('signature', signParams(del));
const gone = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`, {
  method: 'POST',
  body: delForm,
});
console.log('Test image deleted:', (await gone.json()).result);
