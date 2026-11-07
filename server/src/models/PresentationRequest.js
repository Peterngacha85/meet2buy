import mongoose from 'mongoose';

// "Ready to buy? Get a demo" while the shop is closed (doc 02 §2.2).
// The seller sees these in the dashboard and demonstrates the product when they next go live.
const presentationRequestSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: mongoose.Schema.Types.ObjectId, default: null },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    message: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, enum: ['open', 'seen', 'closed'], default: 'open' },
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

presentationRequestSchema.index({ store: 1, status: 1, createdAt: -1 });
presentationRequestSchema.index({ buyer: 1, store: 1, product: 1, status: 1 });

export const PresentationRequest = mongoose.model('PresentationRequest', presentationRequestSchema);
