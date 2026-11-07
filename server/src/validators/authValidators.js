import { z } from 'zod';
import { normalizePhone } from '../utils/phone.js';

const name = z.string().trim().min(2, 'Name is too short').max(80, 'Name is too long');
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

export const phone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalised = normalizePhone(value);
    if (!normalised) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid Kenyan phone number, e.g. 0712 345 678' });
      return z.NEVER;
    }
    return normalised;
  });

export const registerSchema = z.object({ name, email, phone, password });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const updateMeSchema = z
  .object({
    name: name.optional(),
    phone: phone.optional(),
    avatar: z.url('Avatar must be a URL').nullable().optional(),
    currentPassword: z.string().optional(),
    newPassword: password.optional(),
  })
  .refine((d) => !d.newPassword || d.currentPassword, {
    message: 'Enter your current password to set a new one',
    path: ['currentPassword'],
  });
