import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

// Only Sprint 1 variables are required. LiveKit, Cloudinary and M-Pesa
// variables are added here (and made required) as their modules are built.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.url().default('http://localhost:5173'),
  API_PUBLIC_URL: z.url().optional(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  // 'lax' when client and API share a site (localhost proxy, app./api. on one domain).
  // 'none' when they are on different sites (*.vercel.app frontend + *.onrender.com API).
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  MONGO_URI: z.string().optional(),

  // Admin account, created/updated on every server start (see services/adminBootstrap.js).
  ADMIN_EMAIL: z.preprocess(blankToUndefined, z.email('ADMIN_EMAIL must be a valid email').optional()),
  ADMIN_PASSWORD: z.preprocess(
    blankToUndefined,
    z.string().min(12, 'ADMIN_PASSWORD must be at least 12 characters').optional(),
  ),
  ADMIN_NAME: z.preprocess(blankToUndefined, z.string().default('Meet2buy Admin')),
  ADMIN_PHONE: z.preprocess(blankToUndefined, z.string().optional()),
}).refine((e) => Boolean(e.ADMIN_EMAIL) === Boolean(e.ADMIN_PASSWORD), {
  message: 'Set both ADMIN_EMAIL and ADMIN_PASSWORD, or neither',
  path: ['ADMIN_EMAIL'],
});

function blankToUndefined(v) {
  return typeof v === 'string' && v.trim() === '' ? undefined : v;
}

// Treat `KEY=` (blank) in .env as "not set", so later-sprint keys can stay empty.
const raw = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => typeof v !== 'string' || v.trim() !== ''),
);
const parsed = schema.safeParse(raw);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
