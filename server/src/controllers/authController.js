import { env } from '../config/env.js';
import { consent } from '../config/legal.js';
import { User } from '../models/User.js';
import { Store, privateStore } from '../models/Store.js';
import { Product } from '../models/Product.js';
import { PresentationRequest } from '../models/PresentationRequest.js';
import { resolveDepartments } from '../services/storeService.js';
import { endStoreSession } from '../services/roomService.js';
import { badgeCounts, notifyAdmins } from '../services/notifyService.js';
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
  const user = await User.create({ name, email, phone, password, role: 'buyer', ...consent() });
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

  const user = await User.create({ ...account, role: 'seller', ...consent() });
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
  notifyAdmins({ type: 'seller_review', title: 'New shop waiting for review', body: store.name, link: '/admin/sellers' });
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

  // New to Meet2buy: the Terms & Privacy checkbox must be ticked, as on the sign-up form.
  if (req.body.acceptTerms !== true) {
    throw new AppError(400, 'Please accept the Terms of Use and Privacy Policy to create your account', [
      { field: 'acceptTerms', message: 'Tick the box to accept the Terms of Use and Privacy Policy' },
    ]);
  }
  user = await User.create({
    ...consent(),
    name: (google.name || google.email.split('@')[0]).slice(0, 80),
    email: google.email,
    googleId: google.sub,
    avatar: google.picture ?? null,
    role: 'buyer',
  });
  setAuthCookie(res, user);
  ok(res, { user, isNew: true }, 201);
}

// POST /api/auth/guest { name } — "Continue as a guest": a buyer account with just a name
export async function guest(req, res) {
  if (req.user && !req.user.isGuest) throw new AppError(409, 'You are already logged in');
  const user = await User.create({ name: req.body.name, role: 'buyer', isGuest: true, ...consent() });
  setAuthCookie(res, user);
  ok(res, { user }, 201);
}

// POST /api/auth/guest/save { email, phone, password } — keep the guest's activity under a real account
export async function saveGuest(req, res) {
  if (!req.user.isGuest) throw new AppError(409, 'This account is already saved');
  const { email, phone, password } = req.body;
  if (await User.exists({ email })) {
    throw new AppError(409, 'An account with this email already exists', [
      { field: 'email', message: 'An account with this email already exists. Log in instead.' },
    ]);
  }
  const user = await User.findById(req.user._id);
  Object.assign(user, { email, phone, password, isGuest: false });
  await user.save();
  setAuthCookie(res, user);
  ok(res, { user });
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
  // Tells the account page whether to confirm with a password (Google-only and guest accounts have none).
  const hasPassword = Boolean(await User.exists({ _id: req.user._id, password: { $exists: true, $ne: null } }));
  ok(res, { user: req.user, store, hasPassword });
}

// GET /api/auth/badges — sidebar counts (new demo requests, orders to ship, shops to review)
export async function badges(req, res) {
  ok(res, { badges: await badgeCounts(req.user) });
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

// DELETE /api/auth/me { password?, confirm } — permanently delete your own account.
// Accounts with a password confirm with it; Google-only and guest accounts type DELETE.
// A seller's shop, products and demo requests go with the account.
export async function deleteMe(req, res) {
  const user = await User.findById(req.user._id).select('+password');
  if (user.isEnvOwner) {
    throw new AppError(403, 'The owner admin account is managed from the server settings and cannot be deleted here');
  }
  if (user.password) {
    if (!(await user.comparePassword(req.body.password))) {
      throw new AppError(400, 'Password is incorrect', [{ field: 'password', message: 'Password is incorrect' }]);
    }
  } else if (req.body.confirm !== 'DELETE') {
    throw new AppError(400, 'Type DELETE to confirm', [{ field: 'confirm', message: 'Type DELETE to confirm' }]);
  }

  const stores = await Store.find({ owner: user._id }).select('_id');
  const storeIds = stores.map((s) => s._id);
  await Promise.all(storeIds.map((id) => endStoreSession(id, 'account_deleted')));
  await Promise.all([
    Product.deleteMany({ store: { $in: storeIds } }),
    PresentationRequest.deleteMany({ $or: [{ store: { $in: storeIds } }, { buyer: user._id }] }),
  ]);
  await Store.deleteMany({ _id: { $in: storeIds } });
  await User.deleteOne({ _id: user._id });

  clearAuthCookie(res);
  ok(res, null);
}
