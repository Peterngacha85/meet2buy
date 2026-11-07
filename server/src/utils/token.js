import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env.js';

export const AUTH_COOKIE = 'm2b_token';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: `${env.JWT_EXPIRES_DAYS}d`,
  });
}

/** Returns the decoded payload, or null if the token is missing/invalid/expired. */
export function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch {
    return null;
  }
}

export function cookieOptions() {
  const sameSite = env.COOKIE_SAME_SITE;
  return {
    httpOnly: true,
    // SameSite=None requires Secure; otherwise secure only in production.
    secure: isProd || sameSite === 'none',
    sameSite,
    maxAge: env.JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export function setAuthCookie(res, user) {
  res.cookie(AUTH_COOKIE, signToken(user), cookieOptions());
}

export function clearAuthCookie(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(AUTH_COOKIE, opts);
}
