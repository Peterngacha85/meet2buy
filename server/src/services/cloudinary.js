import crypto from 'node:crypto';
import { env } from '../config/env.js';

// Signed direct uploads: the browser sends the file straight to Cloudinary with a signature
// we create here, so images never pass through (or slow down) our server.
// https://cloudinary.com/documentation/authentication_signatures

export const UPLOAD_KINDS = ['logo', 'banner', 'product', 'avatar'];
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,avif,heic';

export const isCloudinaryConfigured = () =>
  Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

/** Cloudinary signature: SHA-1 of the sorted params string + API secret. */
export function signParams(params, secret = env.CLOUDINARY_API_SECRET) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + secret).digest('hex');
}

/** Everything the browser needs to POST one image to Cloudinary. */
export function createUploadSignature(kind) {
  const params = {
    allowed_formats: ALLOWED_FORMATS,
    folder: `${env.CLOUDINARY_FOLDER}/${kind}s`,
    timestamp: Math.floor(Date.now() / 1000),
  };
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: env.CLOUDINARY_API_KEY,
    params,
    signature: signParams(params),
  };
}

/** Only accept image URLs from our own Cloudinary account. */
export function isOwnImageUrl(url) {
  if (!env.CLOUDINARY_CLOUD_NAME || typeof url !== 'string') return false;
  return url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`);
}
