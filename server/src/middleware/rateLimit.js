import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env.js';

const base = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, res, _next, options) =>
    res.status(options.statusCode).json({
      success: false,
      message: 'Too many requests. Please wait a moment and try again.',
    }),
};

// Login / register: 20 attempts per 15 minutes per IP.
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 20 });

// General API safety net.
export const apiLimiter = rateLimit({ ...base, windowMs: 60 * 1000, limit: 300 });
