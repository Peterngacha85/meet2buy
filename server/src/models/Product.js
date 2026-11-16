import mongoose from 'mongoose';

export const MAX_PRODUCT_IMAGES = 5;
export const MAX_SKUS = 60;

/**
 * Variations (client brief, Nov 2026). `variants` are the option groups, e.g. Storage: 128GB, 256GB and
 * Colour: Black, Blue. `skus` are the combinations a seller actually stocks, each with its own price and
 * stock ("256GB / Blue · KES 64,999 · 3 left"). With skus, the product's price is the lowest sku price and
 * its stock the sum (kept in step on every save and every atomic stock change). Without skus the options
 * are plain choices sharing the product's price and stock.
 */
const skuSchema = new mongoose.Schema({
  options: { type: Map, of: String, required: true }, // { Storage: '256GB', Colour: 'Blue' }
  price: { type: Number, required: true, min: 1, validate: Number.isInteger },
  stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
});

/** "Storage: 256GB · Colour: Blue" in the product's option order. */
export function skuLabel(product, sku) {
  return (product.variants ?? []).map((v) => `${v.label}: ${sku.options.get(v.label)}`).join(' · ');
}

/** The sku matching a choice like { Storage: '256GB', Colour: 'Blue' }, or null. */
export function findSku(product, chosen = {}) {
  return (product.skus ?? []).find((s) => (product.variants ?? []).every((v) => s.options.get(v.label) === chosen?.[v.label])) ?? null;
}

const productSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    // _id of one of the store's departments
    department: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    price: { type: Number, required: true, min: 1, validate: Number.isInteger }, // whole KES
    images: {
      type: [String],
      default: [],
      validate: { validator: (v) => v.length <= MAX_PRODUCT_IMAGES, message: `At most ${MAX_PRODUCT_IMAGES} photos` },
    },
    variants: { type: [{ label: String, options: [String], _id: false }], default: [] },
    skus: { type: [skuSchema], default: [] },
    stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
    isVisible: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      flattenMaps: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        for (const sku of ret.skus ?? []) {
          if (sku._id) {
            sku.id = sku._id.toString();
            delete sku._id;
          }
        }
        return ret;
      },
    },
  },
);

// Skus must match the option groups exactly: one value per group, from that group's options, no duplicates.
productSchema.pre('validate', function checkSkus() {
  if (!this.skus.length) return;
  if (!this.variants.length) {
    this.invalidate('skus', 'Add the options (e.g. Storage, Colour) before adding variations');
    return;
  }
  if (this.skus.length > MAX_SKUS) this.invalidate('skus', `At most ${MAX_SKUS} variations`);
  const seen = new Set();
  this.skus.forEach((sku, i) => {
    const keys = [...sku.options.keys()];
    const fits =
      keys.length === this.variants.length &&
      this.variants.every((v) => v.options.includes(sku.options.get(v.label)));
    if (!fits) {
      this.invalidate(`skus.${i}.options`, 'This variation does not match the options. Re-check it and save again.');
      return;
    }
    const key = this.variants.map((v) => sku.options.get(v.label)).join('|');
    if (seen.has(key)) this.invalidate(`skus.${i}.options`, `${skuLabel(this, sku)} is listed twice`);
    seen.add(key);
  });
  // The product's price and stock follow its variations.
  this.price = Math.min(...this.skus.map((s) => s.price));
  this.stock = this.skus.reduce((n, s) => n + s.stock, 0);
});

productSchema.index({ store: 1, isVisible: 1 });
productSchema.index({ store: 1, department: 1 });

export const Product = mongoose.model('Product', productSchema);
