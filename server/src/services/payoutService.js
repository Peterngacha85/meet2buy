import { Order, Payout } from '../models/Commerce.js';
import { Store } from '../models/Store.js';
import { Settings } from '../models/Settings.js';
import { logger } from '../utils/logger.js';
import { notifyStoreOwner } from './notifyService.js';
import { b2bPayment, isB2BConfigured, onSimulatedB2BResult, transactionStatus } from './mpesa.js';

// Paying the seller (doc 08 §3, §6, §7). Status only moves forward: pending → processing → completed | failed.

/** Commission snapshot for a paid order (doc 08 §4). */
export async function computeSplit(order) {
  const [store, settings] = await Promise.all([Store.findById(order.store).select('commissionRate'), Settings.getGlobal()]);
  const rate = store?.commissionRate ?? settings.defaultCommissionRate;
  const commissionAmount = Math.round((order.amount * rate) / 100);
  const payoutFee = settings.deductPayoutFeeFromSeller ? settings.payoutFee : 0;
  return { commissionRate: rate, commissionAmount, payoutFee, payoutAmount: order.amount - commissionAmount - payoutFee };
}

/**
 * Create the one payout for a paid order. The unique index on `order` makes a second attempt
 * (e.g. a duplicated callback) fail safely. Returns the payout, or null if one already exists.
 */
export async function createPayout(order) {
  const store = await Store.findById(order.store).select('+payout');
  const p = store.payout;
  const till = p.type === 'till';
  try {
    const payout = await Payout.create({
      order: order._id,
      store: store._id,
      amount: order.payoutAmount,
      destinationType: p.type,
      destination: till ? p.tillNumber : p.paybillNumber,
      accountReference: till ? order.orderNumber : p.accountNumber || order.orderNumber,
    });
    await Order.updateOne({ _id: order._id }, { payout: payout._id });
    return payout;
  } catch (err) {
    if (err.code === 11000) return null;
    throw err;
  }
}

/** Send a pending payout with B2B. Never throws: failures are recorded on the payout for the admin to retry. */
export async function sendPayout(payoutId) {
  const payout = await Payout.findOneAndUpdate(
    { _id: payoutId, status: 'pending' },
    { status: 'processing', $inc: { attempts: 1 }, lastAttemptAt: new Date(), resultCode: null, resultDesc: null },
    { returnDocument: 'after' },
  );
  if (!payout) return null;

  if (!isB2BConfigured()) {
    return Payout.findByIdAndUpdate(
      payout._id,
      { status: 'failed', resultDesc: 'M-Pesa payouts are not set up yet (B2B keys missing)' },
      { returnDocument: 'after' },
    );
  }
  const order = await Order.findById(payout.order).select('orderNumber');
  try {
    const res = await b2bPayment({
      destinationType: payout.destinationType,
      destination: payout.destination,
      accountReference: payout.accountReference,
      amount: payout.amount,
      remarks: `Meet2buy ${order.orderNumber}`,
      relatedId: payout._id,
    });
    return Payout.findByIdAndUpdate(
      payout._id,
      { conversationId: res.ConversationID, originatorConversationId: res.OriginatorConversationID },
      { returnDocument: 'after' },
    );
  } catch (err) {
    logger.warn(`payout ${payout._id} request failed: ${err.message}`);
    return Payout.findByIdAndUpdate(payout._id, { status: 'failed', resultDesc: err.message }, { returnDocument: 'after' });
  }
}

/** Safaricom's B2B result (or the simulator's). */
export async function applyB2BResult(body, { retries = 3 } = {}) {
  const r = body?.Result;
  if (!r?.ConversationID && !r?.OriginatorConversationID) return null;
  const match = {
    $or: [
      ...(r.ConversationID ? [{ conversationId: r.ConversationID }] : []),
      ...(r.OriginatorConversationID ? [{ originatorConversationId: r.OriginatorConversationID }] : []),
    ],
  };
  const ok = Number(r.ResultCode) === 0;
  const payout = await Payout.findOneAndUpdate(
    { ...match, status: 'processing' },
    ok
      ? { status: 'completed', resultCode: 0, resultDesc: r.ResultDesc, transactionId: r.TransactionID, completedAt: new Date() }
      : { status: 'failed', resultCode: Number(r.ResultCode), resultDesc: r.ResultDesc },
    { returnDocument: 'after' },
  );
  // The result can beat us saving the ConversationID from Safaricom's reply by a few ms: try again shortly.
  if (!payout && retries > 0 && !(await Payout.exists({ ...match, status: { $in: ['completed', 'failed'] } }))) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return applyB2BResult(body, { retries: retries - 1 });
  }
  if (!payout) logger.warn(`B2B result for unknown or settled payout ${r.ConversationID}`);
  else if (payout.status === 'completed') {
    await notifyStoreOwner(payout.store, {
      type: 'payout',
      title: `KES ${payout.amount.toLocaleString('en-KE')} sent to you`,
      body: `Paid to your ${payout.destinationType === 'till' ? 'Till' : 'Paybill'} ${payout.destination}. M-Pesa ref ${payout.transactionId}.`,
      link: '/seller/orders',
    });
  }
  return payout;
}

/** The request sat in Safaricom's queue too long. Don't mark failed: ask what really happened (doc 08 §3). */
export async function applyB2BTimeout(body) {
  const r = body?.Result ?? body;
  const payout = await Payout.findOneAndUpdate(
    { $or: [{ conversationId: r?.ConversationID }, { originatorConversationId: r?.OriginatorConversationID }], status: 'processing' },
    { timedOutAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!payout) return null;
  await transactionStatus({ originatorConversationId: payout.originatorConversationId, relatedId: payout._id }).catch((err) =>
    logger.warn(`status query for payout ${payout._id} failed: ${err.message}`),
  );
  return payout;
}

/** Transaction Status result for a timed-out payout. Unclear answers leave it processing for the admin. */
export async function applyStatusResult(body) {
  const r = body?.Result;
  if (!r) return null;
  const params = Object.fromEntries((r.ResultParameters?.ResultParameter ?? []).map((p) => [p.Key, p.Value]));
  const occasion = (r.ReferenceData?.ReferenceItem && [].concat(r.ReferenceData.ReferenceItem).find((i) => i.Key === 'Occasion')?.Value) || null;
  // 'failed' too: an admin retry asks first whether a "failed" payout actually went through.
  const open = { $in: ['processing', 'failed'] };
  const payout = occasion
    ? await Payout.findOne({ _id: occasion, status: open }).catch(() => null)
    : await Payout.findOne({ originatorConversationId: r.OriginatorConversationID, status: open });
  if (!payout || Number(r.ResultCode) !== 0) return null;
  const state = String(params.TransactionStatus ?? '').toLowerCase();
  if (state === 'completed') {
    return Payout.findOneAndUpdate(
      { _id: payout._id, status: open },
      { status: 'completed', transactionId: params.ReceiptNo ?? payout.transactionId, resultCode: 0, resultDesc: 'Confirmed by status check', completedAt: new Date() },
      { returnDocument: 'after' },
    );
  }
  if (['failed', 'cancelled', 'declined'].includes(state)) {
    return Payout.findOneAndUpdate(
      { _id: payout._id, status: 'processing' },
      { status: 'failed', resultDesc: `Status check: ${params.TransactionStatus}` },
      { returnDocument: 'after' },
    );
  }
  return null;
}

onSimulatedB2BResult((body) => applyB2BResult(body).catch((err) => logger.error('simulated B2B result failed', err)));
