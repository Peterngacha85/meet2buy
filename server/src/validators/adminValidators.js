import { z } from 'zod';

export const closeRoomSchema = z.object({ reason: z.string().trim().max(200).optional() });

export const resolveOrderSchema = z.object({
  action: z.enum(['pay', 'cancel']),
  note: z.string().trim().min(3, 'Write what you checked, e.g. the M-Pesa statement line').max(300),
});

const whole = (min, max, label) =>
  z.coerce.number({ error: `${label} must be a number` }).int(`${label} must be a whole number`).min(min).max(max);

export const settingsSchema = z
  .object({
    defaultCommissionRate: z.coerce.number().min(0).max(50, 'Commission above 50% is not allowed'),
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
