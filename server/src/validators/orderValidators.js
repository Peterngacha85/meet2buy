import { z } from 'zod';
import { objectId } from './storeValidators.js';
import { normalizePhone } from '../utils/phone.js';

const phone = z
  .string({ error: 'Phone number is required' })
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: 'custom', message: 'Enter a valid Kenyan phone number, e.g. 0712 345 678' });
    return n ?? v;
  });

export const deliverySchema = z.object({
  name: z.string().trim().min(2, 'Enter the name to deliver to').max(80),
  phone,
  location: z.string().trim().min(3, 'Enter the delivery location or address').max(200),
  notes: z.string().trim().max(300).optional().default(''),
});

// Either a product at its listed price (with quantity and variant) or an offer from the seller.
export const checkoutSchema = z
  .object({
    productId: objectId('product').optional(),
    quantity: z.coerce.number().int().min(1, 'At least 1').max(10, 'At most 10 per order').optional().default(1),
    variant: z.record(z.string(), z.string().max(60)).optional(),
    offerId: objectId('offer').optional(),
    sessionId: objectId('room').optional(),
    mpesaPhone: z.string({ error: 'Enter your M-Pesa number' }).min(9, 'Enter your M-Pesa number'),
    delivery: deliverySchema,
  })
  .refine((b) => Boolean(b.productId) !== Boolean(b.offerId), { message: 'Choose a product or an offer', path: ['productId'] });

export const fulfilmentSchema = z.object({ status: z.enum(['shipped', 'delivered']) });

export const simulateSchema = z.object({ action: z.enum(['pay', 'cancel']) });
