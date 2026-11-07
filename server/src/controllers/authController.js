import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Store, privateStore } from '../models/Store.js';
import { resolveDepartments } from '../services/storeService.js';
import { isGoogleConfigured, verifyGoogleIdToken } from '../services/google.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/respond.js';
import { clearAuthCookie, setAuthCookie } from '../utils/token.js';

// POST /api/auth/register — buyer registration
export async function register(req, res) {
  const { name, email, phone, password } = req.body;
  if (await User.exists({ email })) {
    throw new AppError(409, 'An account with this email already exists', [
      { field: 'email', message: 'An account with this email already exists' },
    ]);
  }
  const user = await User.create({ name, email, phone, password, role: 'buyer' });
  setAuthCookie(res, user);
  ok(res, { user }, 201);
}

// POST /api/auth/register-seller — account + shop + payout details; the shop waits for admin approval.
export async function registerSeller(req, res) {
  const { account, store: shop, payout } = req.body;
  if (await User.exists({ email: account.email })) {
    throw new AppError(409, 'An account with this email already exists', [
      { field: 'account.email', message: 'An account with this email already exists. Log in instead.' },
    ]);
  }
  const departments = await resolveDepartments(shop.departments);

  const user = await User.create({ ...account, role: 'seller' });
  let store;
  try {
    store = await Store.create({
      owner: user._id,
      name: shop.name,
      slug: await Store.uniqueSlug(shop.name),
      description: shop.description,
      departments,
      payout,
    });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // no half-created sellers
    throw err;
  }

  setAuthCookie(res, user);
  ok(res, { user, store: privateStore(store) }, 201);
}

// POST /api/auth/login
export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');

  // A disabled account looks exactly like a wrong password.
  if (!user || user.status === 'disabled' || !(await user.comparePassword(password))) {
    throw new AppError(401, 'Incorrect email or password');
  }
  if (user.status !== 'active') {
    throw new AppError(403, 'This account has been suspended. Contact Meet2buy support.');
  }

  setAuthCookie(res, user);
  ok(res, { user });
}

// POST /api/auth/google { credential } — log in or sign up (as a buyer) with a Google ID token
export async function googleLogin(req, res) {
  if (!isGoogleConfigured()) throw new AppError(503, 'Google sign-in is not set up yet');

  const google = await verifyGoogleIdToken(req.body.credential);
  if (!google) throw new AppError(401, 'Google sign-in failed. Please try again.');
  if (!google.emailVerified) throw new AppError(401, 'Your Google email is not verified');

  let user = (await User.findOne({ googleId: google.sub })) ?? (await User.findOne({ email: google.email }));

  if (user) {
    if (user.status === 'disabled') throw new AppError(401, 'Incorrect email or password');
    // Admin access stays on email + password (the owner admin is managed from .env).
    if (user.role === 'admin') throw new AppError(403, 'Admins log in with email and password');
    if (user.status !== 'active') throw new AppError(403, 'This account has been suspended. Contact Meet2buy support.');
    if (!user.googleId) {
      // Same verified email → link the Google account to the existing one.
      user.googleId = google.sub;
      if (!user.avatar && google.picture) user.avatar = google.picture;
      await user.save();
    }
    setAuthCookie(res, user);
    return ok(res, { user, isNew: false });
  }

  user = await User.create({
    name: (google.name || google.email.split('@')[0]).slice(0, 80),
    email: google.email,
    googleId: google.sub,
    avatar: google.picture ?? null,
    role: 'buyer',
  });
  setAuthCookie(res, user);
  ok(res, { user, isNew: true }, 201);
}

// POST /api/auth/logout
export function logout(_req, res) {
  clearAuthCookie(res);
  ok(res, null);
}

// GET /api/auth/config — public sign-in options for the client
export function config(_req, res) {
  ok(res, { googleClientId: isGoogleConfigured() ? env.GOOGLE_CLIENT_ID : null });
}

// GET /api/auth/me — sellers also get their shop
export async function me(req, res) {
  let store = null;
  if (req.user.role === 'seller') {
    const found = await Store.findOne({ owner: req.user._id }).select('+payout');
    store = found ? privateStore(found) : null;
  }
  ok(res, { user: req.user, store });
}

// PATCH /api/auth/me
export async function updateMe(req, res) {
  const { name, phone, avatar, currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+password');

  if (newPassword) {
    // Google-only accounts (no password yet) can set one without a current password.
    if (user.password && !(await user.comparePassword(currentPassword))) {
      throw new AppError(400, 'Current password is incorrect', [
        { field: 'currentPassword', message: 'Current password is incorrect' },
      ]);
    }
    user.password = newPassword;
  }
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (avatar !== undefined) user.avatar = avatar;

  await user.save();
  ok(res, { user });
}
