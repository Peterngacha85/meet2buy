import { Order, Payment, Payout } from '../models/Commerce.js';
import { Store } from '../models/Store.js';
import { User } from '../models/User.js';
import { nextSeq } from '../models/Counter.js';
import { AppError } from '../utils/AppError.js';

// Receipts (client brief, Nov 2026): every confirmed payment gets a Meet2buy receipt that the buyer,
// the seller and admins can open and print later. The buyer's copy shows what was paid; the seller's
// copy adds the commission and the payout.

export const RECEIPTED = ['paid', 'shipped', 'delivered'];

/** Give a paid order its receipt number once: RCT-2026-000123. Safe to call twice. */
export async function issueReceipt(orderId) {
  const order = await Order.findById(orderId).select('receiptNumber status paidAt');
  if (!order || order.receiptNumber || !RECEIPTED.includes(order.status)) return order?.receiptNumber ?? null;
  const seq = await nextSeq('receipt');
  const year = (order.paidAt ?? new Date()).getFullYear();
  const receiptNumber = `RCT-${year}-${String(seq).padStart(6, '0')}`;
  const res = await Order.updateOne({ _id: orderId, receiptNumber: null }, { receiptNumber, receiptIssuedAt: new Date() });
  if (res.modifiedCount === 1) return receiptNumber;
  return (await Order.findById(orderId).select('receiptNumber')).receiptNumber; // issued meanwhile
}

/** "254712345678" → "0712 ••• 678" (receipts get printed and shared). */
const maskPhone = (p) => (p ? `0${p.slice(3, 6)} ••• ${p.slice(-3)}` : null);

/**
 * The receipt for one order, as `user` may see it: the buyer's copy, the seller's copy (their shop),
 * or the admin copy (everything). 404 for anyone else, and for orders not paid (yet).
 */
export async function receiptFor(user, orderId) {
  let order = await Order.findById(orderId).catch(() => null);
  if (!order) throw new AppError(404, 'Receipt not found');
  const store = await Store.findById(order.store).select('name slug logo brandColor owner');
  const isBuyer = order.buyer.equals(user._id);
  const isSeller = Boolean(store?.owner.equals(user._id));
  const isAdmin = user.role === 'admin';
  if (!isBuyer && !isSeller && !isAdmin) throw new AppError(404, 'Receipt not found');
  if (!RECEIPTED.includes(order.status)) throw new AppError(409, 'A receipt is issued once the payment is confirmed');

  if (!order.receiptNumber) {
    await issueReceipt(order._id); // orders paid before receipts existed
    order = await Order.findById(order._id);
  }
  const [payment, buyer, owner, payout] = await Promise.all([
    Payment.findById(order.payment).select('mpesaReceipt phone paidAt'),
    User.findById(order.buyer).select('name'),
    store ? User.findById(store.owner).select('phone') : null,
    isSeller || isAdmin ? Payout.findOne({ order: order._id }).select('status amount transactionId completedAt destinationType destination') : null,
  ]);
  const copy = isAdmin && !isBuyer && !isSeller ? 'admin' : isSeller ? 'seller' : 'buyer';

  return {
    copy,
    receiptNumber: order.receiptNumber,
    issuedAt: order.receiptIssuedAt ?? order.paidAt,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paidAt: order.paidAt,
    store: store ? { name: store.name, slug: store.slug, logo: store.logo, brandColor: store.brandColor, phone: owner?.phone ?? null } : null,
    buyer: { name: buyer?.name ?? order.delivery.name },
    delivery: order.delivery,
    items: order.items.map((i) => ({ name: i.name, variant: i.variant, quantity: i.quantity, unitPrice: i.unitPrice, total: i.unitPrice * i.quantity })),
    amount: order.amount,
    payment: {
      method: 'M-Pesa',
      mpesaReceipt: payment?.mpesaReceipt ?? null,
      phone: copy === 'buyer' ? maskPhone(payment?.phone) : (payment?.phone ?? null),
      paidAt: payment?.paidAt ?? order.paidAt,
    },
    ...(copy !== 'buyer'
      ? {
          settlement: {
            commissionRate: order.commissionRate,
            commissionAmount: order.commissionAmount,
            payoutFee: order.payoutFee,
            payoutAmount: order.payoutAmount,
            payout: payout
              ? {
                  status: payout.status,
                  transactionId: payout.transactionId,
                  completedAt: payout.completedAt,
                  to: `${payout.destinationType === 'till' ? 'Till' : 'Paybill'} ${payout.destination}`,
                }
              : null,
          },
        }
      : {}),
  };
}
