import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { clearAuthCookie, setAuthCookie } from '../utils/token.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

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

// GET /api/auth/me
// Sprint 2: include the seller's store here.
export function me(req, res) {
  ok(res, { user: req.user });
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
