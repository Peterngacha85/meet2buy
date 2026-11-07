import mongoose from 'mongoose';

export const MAX_PRODUCT_IMAGES = 5;

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
    stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
    isVisible: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

productSchema.index({ store: 1, isVisible: 1 });
productSchema.index({ store: 1, department: 1 });

export const Product = mongoose.model('Product', productSchema);
