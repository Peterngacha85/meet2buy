import { z } from 'zod';
import mongoose from 'mongoose';
import { isOwnImageUrl } from '../services/cloudinary.js';
import { MAX_PRODUCT_IMAGES } from '../models/Product.js';
import { registerSchema } from './authValidators.js';

export const objectId = (label = 'id') =>
  z.string().refine((v) => mongoose.isValidObjectId(v), `Invalid ${label}`);

export const imageUrl = z
  .string()
  .refine(isOwnImageUrl, 'Upload the image again — it must come from the Meet2buy uploader');

const digits = (min, max, label) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ''))
    .pipe(z.string().regex(new RegExp(`^\\d{${min},${max}}$`), `${label} must be ${min}–${max} digits`));

const registeredName = z.string().trim().min(2, 'Enter the name registered on M-Pesa').max(80);

export const payoutSchema = z.discriminatedUnion(
  'type',
  [
    z.object({ type: z.literal('till'), tillNumber: digits(5, 8, 'Till number'), registeredName }),
    z.object({
      type: z.literal('paybill'),
      paybillNumber: digits(5, 7, 'Paybill number'),
      accountNumber: z.string().trim().min(1, 'Enter the account number').max(20, 'Account number is too long'),
      registeredName,
    }),
  ],
  { error: 'Choose Till (Buy Goods) or Paybill' },
);

const department = z.object({
  id: objectId('department').optional(),
  name: z.string().trim().min(2, 'Department name is too short').max(40, 'Department name is too long'),
  wing: z.string().trim().min(1, 'Choose a wing'),
});

const departments = z
  .array(department)
  .min(1, 'Add at least one department')
  .max(12, 'At most 12 departments')
  .refine(
    (list) => new Set(list.map((d) => d.name.toLowerCase())).size === list.length,
    'Each department needs a different name',
  );

const storeName = z.string().trim().min(2, 'Shop name is too short').max(60, 'Shop name is too long');
const description = z.string().trim().max(500, 'Keep the description under 500 characters');
const brandColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour');

export const registerSellerSchema = z.object({
  account: registerSchema,
  store: z.object({
    name: storeName,
    description: description.optional().default(''),
    departments,
  }),
  payout: payoutSchema,
});

export const updateStoreSchema = z.object({
  name: storeName.optional(),
  description: description.optional(),
  logo: imageUrl.nullable().optional(),
  banner: imageUrl.nullable().optional(),
  brandColor: brandColor.optional(),
  departments: departments.optional(),
});

const variant = z.object({
  label: z.string().trim().min(1).max(30),
  options: z.array(z.string().trim().min(1).max(30)).min(1).max(20),
});

const productFields = {
  name: z.string().trim().min(2, 'Product name is too short').max(100, 'Product name is too long'),
  department: objectId('department'),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().int('Price must be whole shillings').min(1, 'Price must be at least KES 1').max(10_000_000),
  stock: z.coerce.number().int('Stock must be a whole number').min(0, 'Stock cannot be negative').max(100_000),
  images: z.array(imageUrl).max(MAX_PRODUCT_IMAGES, `At most ${MAX_PRODUCT_IMAGES} photos`).optional(),
  variants: z.array(variant).max(3).optional(),
  isVisible: z.boolean().optional(),
};

export const createProductSchema = z.object(productFields);
export const updateProductSchema = z.object(productFields).partial();

export const uploadSignatureSchema = z.object({
  kind: z.enum(['logo', 'banner', 'product', 'avatar'], { error: 'Unknown upload type' }),
});

export const presentationRequestSchema = z.object({
  product: objectId('product').nullable().optional(),
  department: objectId('department').nullable().optional(),
  message: z.string().trim().max(300).optional(),
});

export const requestStatusSchema = z.object({ status: z.enum(['open', 'seen', 'closed']) });

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, 'Tell the seller why').max(300),
});
export const suspendSchema = z.object({ reason: z.string().trim().max(300).optional() });
