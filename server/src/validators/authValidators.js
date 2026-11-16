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

// The Terms & Privacy checkbox. Required wherever a new account is created.
export const acceptTerms = z.literal(true, { error: 'Please accept the Terms of Use and Privacy Policy' });

export const registerSchema = z.object({ name, email, phone, password, acceptTerms });

// The seller's account step (acceptTerms is asked once, at the end of the wizard).
export const accountSchema = z.object({ name, email, phone, password });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const guestSchema = z.object({ name, acceptTerms });

// Turn a guest into a full account (keeps their demo requests, orders, etc.).
export const saveGuestSchema = z.object({ email, phone, password });

export const googleSchema = z.object({
  credential: z.string().min(20, 'Missing Google credential').max(5000),
  // Needed only when this Google account is new to Meet2buy (checked in the controller).
  acceptTerms: z.boolean().optional(),
});

// Which of the two is needed depends on the account (checked in the controller).
export const deleteMeSchema = z.object({
  password: z.string().max(128).optional(),
  confirm: z.string().max(20).optional(),
});

// currentPassword is checked in the controller: required only if the account already has a password.
export const updateMeSchema = z.object({
  name: name.optional(),
  phone: phone.optional(),
  avatar: z.url('Avatar must be a URL').nullable().optional(),
  currentPassword: z.string().optional(),
  newPassword: password.optional(),
});
