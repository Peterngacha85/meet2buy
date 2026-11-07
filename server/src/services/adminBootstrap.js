import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { normalizePhone } from '../utils/phone.js';
import { logger } from '../utils/logger.js';

const fromEnv = () => ({
  email: env.ADMIN_EMAIL,
  password: env.ADMIN_PASSWORD,
  name: env.ADMIN_NAME,
  phone: env.ADMIN_PHONE,
});

/**
 * Make sure the admin from .env exists and can log in. Runs on every server start.
 *  - No account with that email → create it as admin.
 *  - Account exists → make it admin, reactivate it, and sync the password if .env changed.
 *  - ADMIN_EMAIL changed → the previous .env admin is disabled.
 * .env is the source of truth: to change the admin password, change ADMIN_PASSWORD and restart.
 * If the ADMIN_* variables are removed, nothing changes (the current owner keeps working).
 */
export async function ensureAdminFromEnv(config = fromEnv()) {
  const { password, name = 'Meet2buy Admin' } = config;
  const email = config.email?.trim().toLowerCase();

  if (!email || !password) {
    logger.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin setup');
    return null;
  }

  let phone;
  if (config.phone) {
    phone = normalizePhone(config.phone) ?? undefined;
    if (!phone) logger.warn('ADMIN_PHONE is not a valid Kenyan mobile number — ignoring it');
  }

  // ADMIN_EMAIL changed → the previous owner admin stops working immediately
  // (login says "Incorrect email or password"; existing sessions are rejected).
  const retired = await User.updateMany(
    { isEnvOwner: true, email: { $ne: email } },
    { $set: { isEnvOwner: false, status: 'disabled' } },
  );
  if (retired.modifiedCount) logger.info(`Previous .env admin disabled (${retired.modifiedCount})`);

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    const created = await User.create({ name, email, password, phone, role: 'admin', isEnvOwner: true });
    logger.info(`Admin account created: ${email}`);
    return created;
  }

  const changes = [];
  if (user.role !== 'admin') {
    changes.push(`role ${user.role} → admin`);
    user.role = 'admin';
  }
  if (user.status !== 'active') {
    changes.push('reactivated');
    user.status = 'active';
  }
  if (!user.isEnvOwner) {
    changes.push('marked as .env owner');
    user.isEnvOwner = true;
  }
  if (!(await user.comparePassword(password))) {
    changes.push('password updated from .env');
    user.password = password;
  }
  if (phone && user.phone !== phone) {
    changes.push('phone updated');
    user.phone = phone;
  }

  if (changes.length) {
    await user.save();
    logger.info(`Admin account ${email}: ${changes.join(', ')}`);
  }
  return user;
}
