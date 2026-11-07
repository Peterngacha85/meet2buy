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

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    defaultCommissionRate: { type: Number, default: 8, min: 0, max: 100 },
    deductPayoutFeeFromSeller: { type: Boolean, default: false },
    offerExpiryMinutes: { type: Number, default: 10 },
    counterTimeLimitMinutes: { type: Number, default: 5 },
    wings: { type: [wingSchema], default: () => DEFAULT_WINGS },
  },
  { timestamps: true },
);

/** The single settings document, created with defaults on first use. */
settingsSchema.statics.getGlobal = async function getGlobal() {
  const found = await this.findOne({ key: 'global' });
  if (found) return found;
  try {
    return await this.create({ key: 'global' });
  } catch (err) {
    if (err.code === 11000) return this.findOne({ key: 'global' });
    throw err;
  }
};

export const Settings = mongoose.model('Settings', settingsSchema);
