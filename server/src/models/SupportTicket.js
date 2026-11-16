import mongoose from 'mongoose';

// After-sales service (client brief, Nov 2026): a buyer raises a problem with a paid order, the seller
// answers, and either side can bring Meet2buy in. Every message is kept for future reference.
const { ObjectId } = mongoose.Schema.Types;

export const TICKET_CATEGORIES = ['not_delivered', 'faulty', 'damaged', 'wrong_item', 'warranty', 'refund_return', 'other'];
// open: waiting for the seller · in_progress: the seller answered · escalated: Meet2buy is involved
// resolved: the seller (or Meet2buy) says it's sorted, the buyer can reopen · closed: done for good
export const TICKET_STATUSES = ['open', 'in_progress', 'escalated', 'resolved', 'closed'];
export const ACTIVE_TICKET = ['open', 'in_progress', 'escalated'];

const messageSchema = new mongoose.Schema(
  {
    author: { type: ObjectId, ref: 'User', default: null },
    role: { type: String, enum: ['buyer', 'seller', 'admin', 'system'], required: true },
    name: { type: String, required: true },
    body: { type: String, required: true, maxlength: 2000 },
    images: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true }, // AS-000123
    order: { type: ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String, required: true },
    receiptNumber: { type: String, default: null },
    buyer: { type: ObjectId, ref: 'User', required: true },
    store: { type: ObjectId, ref: 'Store', required: true },
    productName: { type: String, required: true },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    status: { type: String, enum: TICKET_STATUSES, default: 'open' },
    messages: { type: [messageSchema], default: [] },
    escalatedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        for (const m of ret.messages ?? []) {
          m.id = m._id?.toString();
          delete m._id;
        }
        return ret;
      },
    },
  },
);
ticketSchema.index({ buyer: 1, lastActivityAt: -1 });
ticketSchema.index({ store: 1, status: 1, lastActivityAt: -1 });
ticketSchema.index({ status: 1, lastActivityAt: -1 });
ticketSchema.index({ order: 1 });

export const SupportTicket = mongoose.model('SupportTicket', ticketSchema);
