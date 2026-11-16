import { Offer, Order, Payment, newOrderNumber } from '../models/Commerce.js';
import { Product, findSku, skuLabel } from '../models/Product.js';
import { Store } from '../models/Store.js';
import { RoomSession } from '../models/RoomSession.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { normalizePhone } from '../utils/phone.js';
import { emitTo, sessionRoom, sellerRoom, userRoom } from '../sockets/io.js';
import { isStkConfigured, paymentsOff, stkPush, stkQuery } from './mpesa.js';
import { computeSplit, createPayout, sendPayout } from './payoutService.js';
import { postSystemMessage } from './roomService.js';
import { notifyStoreOwner } from './notifyService.js';
import { issueReceipt } from './receiptService.js';

// Checkout and the life of an order (doc 08 §3). Real money: every step is atomic and runs at most once.

export const MAX_QUANTITY = 10;
export const UNPAID_TIMEOUT_MS = 5 * 60_000;

/** { Colour: 'Black', Size: 'M' } → "Colour: Black · Size: M", checked against the product's options. */
function variantLabel(product, chosen = {}) {
  const parts = [];
  for (const v of product.variants ?? []) {
    const pick = chosen?.[v.label];
    if (!pick) throw new AppError(400, `Choose a ${v.label.toLowerCase()}`, [{ field: `variant.${v.label}`, message: `Choose a ${v.label.toLowerCase()}` }]);
    if (!v.options.includes(pick)) throw new AppError(400, `That ${v.label.toLowerCase()} is not available`);
    parts.push(`${v.label}: ${pick}`);
  }
  return parts.join(' · ');
}

/** Take stock atomically: from one variation (and the product total) when skuId is given. */
export async function reserveStock(productId, quantity, skuId = null) {
  const res = skuId
    ? await Product.updateOne(
        { _id: productId, skus: { $elemMatch: { _id: skuId, stock: { $gte: quantity } } } },
        { $inc: { 'skus.$.stock': -quantity, stock: -quantity } },
      )
    : await Product.updateOne({ _id: productId, stock: { $gte: quantity } }, { $inc: { stock: -quantity } });
  return res.modifiedCount === 1;
}

/** Put stock back. A variation deleted meanwhile has nothing to return to (the seller recounts on save). */
function returnStock(productId, quantity, skuId = null) {
  return skuId
    ? Product.updateOne({ _id: productId, 'skus._id': skuId }, { $inc: { 'skus.$.stock': quantity, stock: quantity } })
    : Product.updateOne({ _id: productId }, { $inc: { stock: quantity } });
}

/** Give reserved stock back exactly once (guarded by stockReleased). */
export async function releaseStock(orderId) {
  const order = await Order.findOneAndUpdate({ _id: orderId, stockReleased: false }, { stockReleased: true }, { returnDocument: 'after' });
  if (!order) return false;
  await Promise.all(order.items.map((i) => returnStock(i.product, i.quantity, i.sku)));
  return true;
}

/** Payment didn't happen: the offer goes back to pending, or expired if its time ran out meanwhile. */
async function unlockOffer(offerId) {
  if (!offerId) return;
  const offer = await Offer.findOne({ _id: offerId, status: 'in_checkout' });
  if (!offer) return;
  offer.status = offer.expiresAt > new Date() ? 'pending' : 'expired';
  offer.order = null;
  await offer.save();
  emitTo(userRoom(offer.buyer.toString()), 'offer:updated', { offerId: offer.id, status: offer.status });
  emitTo(sellerRoom(offer.session.toString()), 'offer:updated', { offerId: offer.id, status: offer.status });
}

/**
 * POST /api/orders/checkout — reserve stock, lock the offer, create the order and send the STK push.
 * The amount always comes from the database (product price × quantity, or the offer price).
 */
export async function checkout(user, input) {
  if (!isStkConfigured()) throw paymentsOff();
  const phone = normalizePhone(input.mpesaPhone);
  if (!phone) throw new AppError(400, 'Enter a valid Safaricom number', [{ field: 'mpesaPhone', message: 'Enter a valid Safaricom number, e.g. 0712 345 678' }]);

  let offer = null;
  let product;
  let sku = null;
  let quantity;
  let variant;
  let amount;
  if (input.offerId) {
    offer = await Offer.findOne({ _id: input.offerId, buyer: user._id }).catch(() => null);
    if (!offer) throw new AppError(404, 'Offer not found');
    if (offer.status !== 'pending' || offer.expiresAt <= new Date()) throw new AppError(409, 'This offer is no longer available. Ask the seller for a new one.');
    product = await Product.findOne({ _id: offer.product, isVisible: true });
    ({ quantity, variant } = offer);
    amount = offer.price;
    if (product && offer.sku) {
      sku = product.skus.id(offer.sku);
      if (!sku) throw new AppError(409, 'That variation is no longer available. Ask the seller for a new offer.');
    }
  } else {
    product = await Product.findOne({ _id: input.productId, isVisible: true }).catch(() => null);
    quantity = input.quantity;
    if (product) {
      variant = variantLabel(product, input.variant);
      if (product.skus.length) {
        sku = findSku(product, input.variant);
        if (!sku) throw new AppError(409, `${variant} is not available. Choose another option.`);
        variant = skuLabel(product, sku);
      }
    }
    amount = product ? (sku?.price ?? product.price) * quantity : 0;
  }
  if (!product) throw new AppError(404, 'This product is no longer available');

  const store = await Store.findById(product.store).select('+payout');
  if (!store || store.status !== 'approved') throw new AppError(409, 'This shop is not open right now');
  if (store.owner.equals(user._id)) throw new AppError(400, 'You cannot buy from your own shop');
  if (!store.payout?.verified) throw new AppError(409, 'This shop cannot take payments yet. Please try again later.');

  let sessionId = offer?.session ?? null;
  if (!sessionId && input.sessionId) {
    const live = await RoomSession.findOne({ _id: input.sessionId, store: store._id, status: 'live' }).select('_id').catch(() => null);
    sessionId = live?._id ?? null;
  }

  // 1. Reserve stock (atomic: only if enough is left). Two buyers, one unit → the second gets 409, no STK push.
  if (!(await reserveStock(product._id, quantity, sku?._id))) {
    const left = sku ? sku.stock : product.stock;
    throw new AppError(409, left > 0 ? `Only ${left} left in stock` : 'Sorry, this just sold out');
  }

  // 2. Lock the offer so it can't expire while the buyer types their PIN.
  const order = new Order({
    orderNumber: newOrderNumber(),
    buyer: user._id,
    store: store._id,
    session: sessionId,
    offer: offer?._id ?? null,
    items: [
      {
        product: product._id,
        name: product.name,
        image: product.images[0] ?? null,
        variant,
        sku: sku?._id ?? null,
        quantity,
        unitPrice: Math.round(amount / quantity),
      },
    ],
    amount,
    delivery: input.delivery,
  });
  if (offer) {
    const locked = await Offer.updateOne(
      { _id: offer._id, status: 'pending', expiresAt: { $gt: new Date() } },
      { status: 'in_checkout', order: order._id },
    );
    if (locked.modifiedCount !== 1) {
      await returnStock(product._id, quantity, sku?._id);
      throw new AppError(409, 'This offer is no longer available. Ask the seller for a new one.');
    }
  }

  // 3. Order + payment, then the STK push.
  const payment = await Payment.create({ order: order._id, phone, amount });
  order.payment = payment._id;
  await order.save();

  try {
    const res = await stkPush({ phone, amount, accountReference: order.orderNumber, description: 'Meet2buy', relatedId: order._id });
    payment.merchantRequestId = res.MerchantRequestID;
    payment.checkoutRequestId = res.CheckoutRequestID;
    await payment.save();
  } catch (err) {
    logger.warn(`STK push for ${order.orderNumber} failed: ${err.message}`);
    await failOrder(order._id, { paymentStatus: 'failed', resultDesc: err.message, orderStatus: 'payment_failed', notify: false });
    throw new AppError(502, 'M-Pesa did not accept the request. Check the number and try again.');
  }

  return { order: await Order.findById(order._id), simulated: Boolean(payment.checkoutRequestId?.startsWith('sim_')) };
}

/** Payment didn't go through: release stock and the offer, tell the buyer. Runs once per order. */
async function failOrder(orderId, { paymentStatus, resultCode = null, resultDesc = null, orderStatus, notify = true, message }) {
  const order = await Order.findOneAndUpdate({ _id: orderId, status: 'awaiting_payment' }, { status: orderStatus }, { returnDocument: 'after' });
  if (!order) return null;
  await Payment.updateOne({ _id: order.payment, status: 'pending' }, { status: paymentStatus, resultCode, resultDesc });
  await releaseStock(order._id);
  await unlockOffer(order.offer);
  if (notify) {
    emitTo(userRoom(order.buyer.toString()), 'payment:status', {
      orderId: order.id,
      status: 'failed',
      message: message ?? 'The payment did not go through.',
    });
  }
  return order;
}

const FRIENDLY = {
  1032: 'You cancelled the M-Pesa prompt.',
  1: 'Your M-Pesa balance is not enough for this payment.',
  2001: 'The M-Pesa PIN was wrong.',
  1037: 'Your phone could not be reached. Make sure it is on and has network, then try again.',
  1019: 'The M-Pesa prompt expired before it was answered.',
};

/** Read Safaricom's STK callback body into plain fields. */
export function parseStkCallback(body) {
  const cb = body?.Body?.stkCallback;
  if (!cb) return null;
  const items = Object.fromEntries((cb.CallbackMetadata?.Item ?? []).map((i) => [i.Name, i.Value]));
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: Number(cb.ResultCode),
    resultDesc: cb.ResultDesc,
    amount: items.Amount != null ? Number(items.Amount) : null,
    receipt: items.MpesaReceiptNumber ?? null,
    phone: items.PhoneNumber != null ? String(items.PhoneNumber) : null,
  };
}

/** STK result → order paid (and the seller paid) or failed. Safe to call twice with the same callback. */
export async function applyStkResult(result) {
  const payment = await Payment.findOne({ checkoutRequestId: result.checkoutRequestId });
  if (!payment) {
    logger.warn(`STK callback for unknown CheckoutRequestID ${result.checkoutRequestId}`);
    return null;
  }

  if (result.resultCode !== 0) {
    return failOrder(payment.order, {
      paymentStatus: result.resultCode === 1032 ? 'cancelled' : 'failed',
      resultCode: result.resultCode,
      resultDesc: result.resultDesc,
      orderStatus: 'payment_failed',
      message: FRIENDLY[result.resultCode] ?? 'The payment did not go through.',
    });
  }

  // Success. Rule 2: no receipt, no payout.
  if (!result.receipt) {
    logger.warn(`STK success without receipt for ${result.checkoutRequestId}`);
    return null;
  }
  const matches = result.amount === payment.amount;
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: 'pending' },
    {
      status: matches ? 'success' : 'amount_mismatch',
      paidAmount: result.amount,
      mpesaReceipt: result.receipt,
      resultCode: 0,
      resultDesc: result.resultDesc,
      paidAt: new Date(),
    },
    { returnDocument: 'after' },
  ).catch((err) => {
    if (err.code === 11000) return null; // same receipt already recorded
    throw err;
  });

  if (!claimed) {
    // Already settled. A success after we cancelled (timeout) is money in with no order: flag it, never auto-pay.
    if (['timeout', 'failed', 'cancelled'].includes(payment.status) && !payment.mpesaReceipt) {
      await Payment.updateOne({ _id: payment._id }, { paidAmount: result.amount, mpesaReceipt: result.receipt, paidAt: new Date() });
      await Order.updateOne({ _id: payment.order }, { status: 'on_hold', holdReason: 'late_payment' });
      logger.warn(`late payment ${result.receipt} for settled order ${payment.order}: flagged for admin`);
    }
    return null;
  }

  const order = await Order.findById(payment.order);
  if (!matches) {
    await Order.updateOne({ _id: order._id, status: 'awaiting_payment' }, { status: 'on_hold', holdReason: 'amount_mismatch', paidAt: new Date() });
    emitTo(userRoom(order.buyer.toString()), 'payment:status', {
      orderId: order.id,
      status: 'on_hold',
      message: 'We received your payment but the amount did not match. Meet2buy will contact you.',
    });
    return order;
  }

  const split = await computeSplit(order);
  const paid = await Order.findOneAndUpdate(
    { _id: order._id, status: 'awaiting_payment' },
    { status: 'paid', paidAt: new Date(), ...split },
    { returnDocument: 'after' },
  );
  if (!paid) return null;
  await issueReceipt(paid._id).catch((err) => logger.error(`receipt for ${paid.orderNumber} failed`, err));
  if (paid.offer) await Offer.updateOne({ _id: paid.offer }, { status: 'paid' });
  if (paid.session) await RoomSession.updateOne({ _id: paid.session }, { $inc: { totalSales: paid.amount } });

  emitTo(userRoom(paid.buyer.toString()), 'payment:status', {
    orderId: paid.id,
    status: 'success',
    message: `Paid. M-Pesa receipt ${result.receipt}.`,
    receipt: result.receipt,
  });
  if (paid.session) {
    const sid = paid.session.toString();
    emitTo(sessionRoom(sid), 'sale:celebration', { productName: paid.items[0].name });
    emitTo(sellerRoom(sid), 'order:new', { orderId: paid.id, orderNumber: paid.orderNumber, amount: paid.amount });
    await postSystemMessage(sid, `🎉 Someone just bought ${paid.items[0].name}`).catch(() => {});
  }

  await notifyStoreOwner(paid.store, {
    type: 'order',
    title: `New order · KES ${paid.amount.toLocaleString('en-KE')}`,
    body: `${paid.items[0].quantity} × ${paid.items[0].name}. Delivery details are in Orders.`,
    link: '/seller/orders',
  });

  // Pay the seller straight away (doc 08 §1).
  if (paid.payoutAmount >= 1) {
    const payout = await createPayout(paid);
    if (payout) await sendPayout(payout._id);
  } else {
    await Order.updateOne({ _id: paid._id }, { holdReason: 'payout_too_small' });
  }
  return paid;
}

/**
 * No callback yet: ask M-Pesa directly. Used by the status endpoint (after ~90 s) and the sweeper.
 * `cancelIfUnknown`: the sweeper cancels orders older than 5 minutes that are still not paid.
 */
export async function resolvePending(orderId, { cancelIfUnknown = false } = {}) {
  const order = await Order.findOne({ _id: orderId, status: 'awaiting_payment' });
  if (!order) return null;
  const payment = await Payment.findById(order.payment);
  if (!payment || payment.status !== 'pending') return null;

  let answer = { done: false };
  if (payment.checkoutRequestId) {
    await Payment.updateOne({ _id: payment._id }, { lastQueriedAt: new Date() });
    answer = await stkQuery(payment.checkoutRequestId, order._id).catch((err) => {
      logger.warn(`STK query for ${order.orderNumber} failed: ${err.message}`);
      return { done: false };
    });
  }

  if (answer.done && answer.resultCode === 0) {
    // M-Pesa says paid but the callback (with the receipt) never came: hold for the admin, never auto-pay.
    await Order.updateOne({ _id: order._id, status: 'awaiting_payment' }, { status: 'on_hold', holdReason: 'unconfirmed_payment' });
    emitTo(userRoom(order.buyer.toString()), 'payment:status', {
      orderId: order.id,
      status: 'on_hold',
      message: 'M-Pesa shows your payment, and we are confirming it. Meet2buy will update your order shortly.',
    });
    return 'on_hold';
  }
  if (answer.done) {
    await failOrder(order._id, {
      paymentStatus: answer.resultCode === 1032 ? 'cancelled' : 'failed',
      resultCode: answer.resultCode,
      resultDesc: answer.resultDesc,
      orderStatus: 'payment_failed',
      message: FRIENDLY[answer.resultCode] ?? 'The payment did not go through.',
    });
    return 'failed';
  }
  if (cancelIfUnknown) {
    await failOrder(order._id, {
      paymentStatus: 'timeout',
      resultDesc: 'No answer from M-Pesa within 5 minutes',
      orderStatus: 'cancelled',
      message: 'We did not get an answer from M-Pesa, so the order was cancelled. You were not charged — try again.',
    });
    return 'cancelled';
  }
  return 'pending';
}

/** Every minute: orders still unpaid after 5 minutes are checked once more, then cancelled (doc 08 §5). */
export async function sweepUnpaidOrders() {
  const stale = await Order.find({ status: 'awaiting_payment', createdAt: { $lt: new Date(Date.now() - UNPAID_TIMEOUT_MS) } })
    .select('_id')
    .limit(50);
  for (const o of stale) await resolvePending(o._id, { cancelIfUnknown: true }).catch((err) => logger.error('sweeper failed', err));
  return stale.length;
}

let sweeper = null;
export function startSweeper() {
  if (sweeper) return;
  sweeper = setInterval(() => sweepUnpaidOrders().catch((err) => logger.error('sweeper failed', err)), 60_000);
  sweeper.unref?.();
}
