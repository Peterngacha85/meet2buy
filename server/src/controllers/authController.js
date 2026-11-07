import { User } from '../models/User.js';
import { Store, privateStore } from '../models/Store.js';
import { resolveDepartments } from '../services/storeService.js';
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

// POST /api/auth/logout
export function logout(_req, res) {
  clearAuthCookie(res);
  ok(res, null);
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
    if (!(await user.comparePassword(currentPassword))) {
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
