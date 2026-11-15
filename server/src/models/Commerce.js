import crypto from 'node:crypto';
import mongoose from 'mongoose';

// Sales and money (doc 05: offers, orders, payments, payouts, mpesaLogs; doc 08).
const { ObjectId } = mongoose.Schema.Types;

const toJSON = {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

// ---- Offers: the seller's custom price for one buyer, sent from the room ----

export const OFFER_STATUSES = ['pending', 'in_checkout', 'declined', 'expired', 'paid'];

const offerSchema = new mongoose.Schema(
  {
    session: { type: ObjectId, ref: 'RoomSession', required: true },
    store: { type: ObjectId, ref: 'Store', required: true },
    buyer: { type: ObjectId, ref: 'User', required: true },
    product: { type: ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    variant: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    price: { type: Number, required: true, min: 1, validate: Number.isInteger }, // total KES
    status: { type: String, enum: OFFER_STATUSES, default: 'pending' },
    expiresAt: { type: Date, required: true }, // ignored while in_checkout
    order: { type: ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true, toJSON },
);
offerSchema.index({ session: 1, buyer: 1, status: 1 });
export const Offer = mongoose.model('Offer', offerSchema);

// ---- Orders ----

export const ORDER_STATUSES = ['awaiting_payment', 'paid', 'payment_failed', 'on_hold', 'shipped', 'delivered', 'cancelled'];

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    buyer: { type: ObjectId, ref: 'User', required: true },
    store: { type: ObjectId, ref: 'Store', required: true },
    session: { type: ObjectId, ref: 'RoomSession', default: null },
    offer: { type: ObjectId, ref: 'Offer', default: null },
    items: [
      {
        product: { type: ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        image: { type: String, default: null },
        variant: { type: String, default: '' },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        _id: false,
      },
    ],
    amount: { type: Number, required: true, min: 1 }, // total KES charged, always computed on the server
    commissionRate: { type: Number, default: null }, // % snapshot at payment time
    commissionAmount: { type: Number, default: null },
    payoutFee: { type: Number, default: 0 },
    payoutAmount: { type: Number, default: null },
    delivery: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      location: { type: String, required: true },
      notes: { type: String, default: '' },
    },
    status: { type: String, enum: ORDER_STATUSES, default: 'awaiting_payment' },
    stockReleased: { type: Boolean, default: false }, // guards against returning reserved stock twice
    holdReason: { type: String, default: null }, // amount_mismatch | late_payment | unconfirmed_payment
    adminNote: { type: String, default: null }, // how an admin resolved a held order
    paidAt: { type: Date, default: null },
    fulfilledAt: { type: Date, default: null },
    payment: { type: ObjectId, ref: 'Payment', default: null },
    payout: { type: ObjectId, ref: 'Payout', default: null },
  },
  { timestamps: true, toJSON },
);
orderSchema.index({ store: 1, createdAt: -1 });
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: 1 }); // the unpaid-order sweeper
export const Order = mongoose.model('Order', orderSchema);

// Unambiguous characters only (no 0/O, 1/I): "M2B-24A7K9" — fits Daraja's 12-character AccountReference.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function newOrderNumber() {
  const bytes = crypto.randomBytes(6);
  return `M2B-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`;
}

// ---- Payments: buyer → Meet2buy by STK push ----

export const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'cancelled', 'timeout', 'amount_mismatch'];

const paymentSchema = new mongoose.Schema(
  {
    order: { type: ObjectId, ref: 'Order', required: true },
    phone: { type: String, required: true },
    amount: { type: Number, required: true },
    merchantRequestId: { type: String, default: null },
    checkoutRequestId: { type: String, default: null },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    paidAmount: { type: Number, default: null },
    resultCode: { type: Number, default: null },
    resultDesc: { type: String, default: null },
    mpesaReceipt: { type: String, default: null },
    paidAt: { type: Date, default: null },
    lastQueriedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON },
);
paymentSchema.index({ checkoutRequestId: 1 }, { unique: true, partialFilterExpression: { checkoutRequestId: { $type: 'string' } } });
paymentSchema.index({ mpesaReceipt: 1 }, { unique: true, partialFilterExpression: { mpesaReceipt: { $type: 'string' } } });
export const Payment = mongoose.model('Payment', paymentSchema);

// ---- Payouts: Meet2buy → seller by B2B ----

export const PAYOUT_STATUSES = ['pending', 'processing', 'completed', 'failed'];

const payoutSchema = new mongoose.Schema(
  {
    order: { type: ObjectId, ref: 'Order', required: true, unique: true }, // one payout per order, ever
    store: { type: ObjectId, ref: 'Store', required: true },
    amount: { type: Number, required: true, min: 1 },
    destinationType: { type: String, enum: ['till', 'paybill'], required: true },
    destination: { type: String, required: true },
    accountReference: { type: String, required: true },
    status: { type: String, enum: PAYOUT_STATUSES, default: 'pending' },
    conversationId: { type: String, default: null },
    originatorConversationId: { type: String, default: null },
    transactionId: { type: String, default: null },
    resultCode: { type: Number, default: null },
    resultDesc: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    timedOutAt: { type: Date, default: null }, // Safaricom queue timeout: a status check was asked for
    statusCheckedAt: { type: Date, default: null }, // admin retry: asked M-Pesa whether the last attempt really failed
  },
  { timestamps: true, toJSON },
);
payoutSchema.index({ conversationId: 1 });
payoutSchema.index({ originatorConversationId: 1 });
payoutSchema.index({ status: 1, createdAt: -1 });
export const Payout = mongoose.model('Payout', payoutSchema);

// ---- Raw log of every Daraja request and callback (never edited) ----

const mpesaLogSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // oauth | stk_push | stk_query | stk_callback | b2b | b2b_result | b2b_timeout | status | status_result
    direction: { type: String, enum: ['out', 'in'], required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    relatedId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
mpesaLogSchema.index({ createdAt: -1 });
export const MpesaLog = mongoose.model('MpesaLog', mpesaLogSchema);

export function logMpesa(type, direction, payload, relatedId = null) {
  return MpesaLog.create({ type, direction, payload, relatedId: relatedId ? String(relatedId) : null }).catch(() => {});
}
