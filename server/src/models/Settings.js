import mongoose from 'mongoose';

// Mall wings (doc 02 §2.1). Each wing suggests department names to sellers;
// sellers can also type their own. The final list comes from the client (doc 09).
export const DEFAULT_WINGS = [
  {
    name: 'Phones & Tablets',
    slug: 'phones-and-tablets',
    departments: ['Phones & Tablets', 'Phones', 'Tablets', 'Accessories'],
  },
  {
    name: 'Home Appliances',
    slug: 'home-appliances',
    departments: ['Home Appliances', 'TVs', 'Cookers', 'Washing Machines', 'Fridges', 'Sound Systems'],
  },
];

const wingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true },
    departments: { type: [String], default: [] },
  },
  { _id: false },
);

// Commission by selling price (client brief, Nov 2026). The price is the unit price of the item sold.
// `max: null` = no upper limit. Prices outside every band use defaultCommissionRate.
export const DEFAULT_COMMISSION_TIERS = [
  { name: 'Entry-level', min: 5_000, max: 15_000, rate: 2 },
  { name: 'Mid-range', min: 15_001, max: 40_000, rate: 3 },
  { name: 'Premium', min: 40_001, max: 80_000, rate: 4 },
  { name: 'Flagship', min: 80_001, max: null, rate: 5 },
];

const tierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    min: { type: Number, required: true, min: 0 },
    max: { type: Number, default: null },
    rate: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

/** The commission band a unit price falls into, or null. */
export function tierFor(tiers, unitPrice) {
  return (tiers ?? []).find((t) => unitPrice >= t.min && (t.max == null || unitPrice <= t.max)) ?? null;
}

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    defaultCommissionRate: { type: Number, default: 2, min: 0, max: 100 },
    // Bumped by one-time data fixes in getGlobal (1: default rate 8% → 2%, Nov 2026).
    defaultsVersion: { type: Number, default: 0 },
    commissionTiers: { type: [tierSchema], default: () => DEFAULT_COMMISSION_TIERS },
    deductPayoutFeeFromSeller: { type: Boolean, default: false },
    // Safaricom's B2B charge in KES, taken from the seller's payout only when deductPayoutFeeFromSeller is on.
    payoutFee: { type: Number, default: 0, min: 0 },
    offerExpiryMinutes: { type: Number, default: 10 },
    counterTimeLimitMinutes: { type: Number, default: 5 },
    wings: { type: [wingSchema], default: () => DEFAULT_WINGS },
  },
  { timestamps: true },
);

/** The single settings document, created with defaults on first use. */
settingsSchema.statics.getGlobal = async function getGlobal() {
  const found = await this.findOne({ key: 'global' });
  if (found) {
    // Documents created before the 2% default carry the old untouched 8%: move them once.
    if ((found.defaultsVersion ?? 0) < 1) {
      if (found.defaultCommissionRate === 8) found.defaultCommissionRate = 2;
      found.defaultsVersion = 1;
      await found.save();
    }
    return found;
  }
  try {
    return await this.create({ key: 'global' });
  } catch (err) {
    if (err.code === 11000) return this.findOne({ key: 'global' });
    throw err;
  }
};

export const Settings = mongoose.model('Settings', settingsSchema);
