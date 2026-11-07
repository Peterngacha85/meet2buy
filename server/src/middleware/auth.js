import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { AUTH_COOKIE, verifyToken } from '../utils/token.js';

async function loadUser(req) {
  const payload = verifyToken(req.cookies?.[AUTH_COOKIE]);
  if (!payload) return null;
  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') return null;
  return user;
}

/** Requires a logged-in, active user. Sets req.user. */
export async function protect(req, _res, next) {
  const user = await loadUser(req);
  if (!user) throw new AppError(401, 'Please log in to continue');
  req.user = user;
  next();
}

/** Sets req.user if logged in, but lets guests through (e.g. watching a room). */
export async function optionalAuth(req, _res, next) {
  req.user = await loadUser(req);
  next();
}
