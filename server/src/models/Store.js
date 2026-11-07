import mongoose from 'mongoose';
import { slugify } from '../utils/slug.js';

export const STORE_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];

// A shop is divided into departments (e.g. Hisense: TVs, Cookers, Fridges).
// Each department sits in one mall wing, so a shop appears in every wing it has a department in.
const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  slug: { type: String, required: true },
  wing: { type: String, required: true }, // wing slug from settings
});

const payoutSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['till', 'paybill'], required: true },
    tillNumber: String,
    paybillNumber: String,
    accountNumber: String,
    registeredName: { type: String, required: true, trim: true },
    verified: { type: Boolean, default: false },
  },
  { _id: false },
);

const storeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    logo: { type: String, default: null },
    banner: { type: String, default: null },
    // The shop's own signage colour (its branding inside the mall).
    brandColor: { type: String, default: '#0B1F5C', match: /^#[0-9a-fA-F]{6}$/ },
    departments: { type: [departmentSchema], default: [] },
    // Derived from departments; indexed so a wing page is one query.
    wings: { type: [String], default: [], index: true },
    openingHours: { type: [{ day: String, open: String, close: String, _id: false }], default: [] },
    status: { type: String, enum: STORE_STATUSES, default: 'pending' },
    rejectionReason: { type: String, default: null },
    statusChangedAt: { type: Date, default: null },
    // Private: only the owner and admins see payout details.
    payout: { type: payoutSchema, required: true, select: false },
    commissionRate: { type: Number, default: null, min: 0, max: 100 },
    isLive: { type: Boolean, default: false },
    currentSession: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomSession', default: null },
  },
  { timestamps: true },
);

storeSchema.index({ status: 1, wings: 1 });
storeSchema.index({ isLive: 1 });

storeSchema.pre('validate', function syncDerived() {
  for (const d of this.departments) d.slug = slugify(d.name);
  this.wings = [...new Set(this.departments.map((d) => d.wing))];
});

/** First free slug for a shop name: "tecno", "tecno-2", … */
storeSchema.statics.uniqueSlug = async function uniqueSlug(name, excludeId) {
  const base = slugify(name);
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const clash = await this.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
    if (!clash) return candidate;
  }
};

export const Store = mongoose.model('Store', storeSchema);

/** What shoppers may see. Never includes payout, commission or rejection details. */
export function publicStore(store) {
  return {
    id: store._id.toString(),
    name: store.name,
    slug: store.slug,
    description: store.description,
    logo: store.logo,
    banner: store.banner,
    brandColor: store.brandColor,
    departments: store.departments.map((d) => ({ id: d._id.toString(), name: d.name, slug: d.slug, wing: d.wing })),
    wings: store.wings,
    openingHours: store.openingHours,
    isLive: store.isLive,
  };
}

/** What the owner and admins see. */
export function privateStore(store) {
  return {
    ...publicStore(store),
    owner: store.owner?._id ? store.owner._id.toString() : store.owner?.toString(),
    status: store.status,
    rejectionReason: store.rejectionReason,
    statusChangedAt: store.statusChangedAt,
    payout: store.payout ? store.payout.toObject?.() ?? store.payout : undefined,
    commissionRate: store.commissionRate,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  };
}
