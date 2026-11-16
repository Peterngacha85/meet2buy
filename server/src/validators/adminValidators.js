import { z } from 'zod';

export const closeRoomSchema = z.object({ reason: z.string().trim().max(200).optional() });

export const resolveOrderSchema = z.object({
  action: z.enum(['pay', 'cancel']),
  note: z.string().trim().min(3, 'Write what you checked, e.g. the M-Pesa statement line').max(300),
});

const whole = (min, max, label) =>
  z.coerce.number({ error: `${label} must be a number` }).int(`${label} must be a whole number`).min(min).max(max);

const rate = z.coerce.number({ error: 'Rate must be a number' }).min(0, 'Rate cannot be negative').max(50, 'Commission above 50% is not allowed');

const tier = z.object({
  name: z.string().trim().min(1, 'Name the band').max(40),
  min: whole(0, 100_000_000, 'From price'),
  max: z.union([z.null(), whole(1, 100_000_000, 'To price')]),
  rate,
});

// Bands sorted by price, no overlaps, each "to" above its "from", only the last may be open-ended.
export const commissionTiers = z
  .array(tier)
  .max(10, 'At most 10 price bands')
  .transform((list) => [...list].sort((a, b) => a.min - b.min))
  .superRefine((list, ctx) => {
    list.forEach((t, i) => {
      if (t.max != null && t.max < t.min) {
        ctx.addIssue({ code: 'custom', path: [i, 'max'], message: `${t.name}: "to" must be above "from"` });
      }
      if (t.max == null && i < list.length - 1) {
        ctx.addIssue({ code: 'custom', path: [i, 'max'], message: `${t.name}: only the highest band can have no upper limit` });
      }
      const next = list[i + 1];
      if (next && t.max != null && next.min <= t.max) {
        ctx.addIssue({ code: 'custom', path: [i + 1, 'min'], message: `${next.name} overlaps ${t.name}` });
      }
    });
  });

export const settingsSchema = z
  .object({
    defaultCommissionRate: rate,
    commissionTiers,
    deductPayoutFeeFromSeller: z.boolean(),
    payoutFee: whole(0, 500, 'Payout fee'),
    offerExpiryMinutes: whole(1, 120, 'Offer expiry'),
    counterTimeLimitMinutes: whole(1, 60, 'Counter time'),
  })
  .partial();

export const commissionSchema = z.object({
  // null first: z.coerce.number would turn null into 0% instead of "use the default".
  rate: z.union([z.null(), z.coerce.number().min(0).max(50, 'Commission above 50% is not allowed')]),
});

export const suspendUserSchema = z.object({ suspended: z.boolean() });

export const addAdminSchema = z.object({
  email: z.email('Enter a valid email').trim().toLowerCase(),
  name: z.string().trim().min(2, 'Enter their name').max(80).optional(),
});
