import { Order, Payment, Payout } from '../models/Commerce.js';
import { Store } from '../models/Store.js';
import { User } from '../models/User.js';
import { Settings } from '../models/Settings.js';
import { Product } from '../models/Product.js';
import { RoomSession } from '../models/RoomSession.js';
import { QueueEntry } from '../models/QueueEntry.js';
import { createRoomToken } from '../services/livekit.js';
import { endSession, loadLiveSession } from '../services/roomService.js';
import { computeSplit, createPayout, sendPayout } from '../services/payoutService.js';
import { releaseStock } from '../services/orderService.js';
import { isSimulated, transactionStatus } from '../services/mpesa.js';
import { notifyUser } from '../services/notifyService.js';
import { presenceOf } from '../sockets/presence.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/slug.js';
import { ok } from '../utils/respond.js';

// Sprint 7 admin (doc 02 §3, doc 06 /api/admin): overview, live rooms, transactions, payouts, settings, users.

const SOLD = ['paid', 'shipped', 'delivered'];

function startOfDay(d = new Date()) {
  // Nairobi day (UTC+3).
  const eat = new Date(d.getTime() + 3 * 3600_000);
  eat.setUTCHours(0, 0, 0, 0);
  return new Date(eat.getTime() - 3 * 3600_000);
}
function startOfMonth(d = new Date()) {
  const eat = new Date(d.getTime() + 3 * 3600_000);
  eat.setUTCDate(1);
  eat.setUTCHours(0, 0, 0, 0);
  return new Date(eat.getTime() - 3 * 3600_000);
}

async function salesSince(since) {
  const [r] = await Order.aggregate([
    { $match: { status: { $in: SOLD }, paidAt: { $gte: since } } },
    { $group: { _id: null, sales: { $sum: '$amount' }, commission: { $sum: '$commissionAmount' }, orders: { $sum: 1 } } },
  ]);
  return { sales: r?.sales ?? 0, commission: r?.commission ?? 0, orders: r?.orders ?? 0 };
}

// GET /api/admin/stats
export async function stats(_req, res) {
  const [today, month, sellers, pending, live, failedPayouts, onHold, buyers] = await Promise.all([
    salesSince(startOfDay()),
    salesSince(startOfMonth()),
    Store.countDocuments({ status: 'approved' }),
    Store.countDocuments({ status: 'pending' }),
    RoomSession.countDocuments({ status: 'live' }),
    Payout.countDocuments({ status: 'failed' }),
    Order.countDocuments({ status: 'on_hold' }),
    User.countDocuments({ role: 'buyer' }),
  ]);
  ok(res, { stats: { today, month, sellers, pending, live, failedPayouts, onHold, buyers }, simulated: isSimulated() });
}

// ---- Live rooms ----

// GET /api/admin/rooms/live
export async function liveRooms(_req, res) {
  const sessions = await RoomSession.find({ status: 'live' }).sort({ startedAt: 1 }).populate('store', 'name slug logo brandColor');
  const rooms = await Promise.all(
    sessions.map(async (s) => {
      const [waiting, counter, pinned] = await Promise.all([
        QueueEntry.countDocuments({ session: s._id, status: 'waiting' }),
        QueueEntry.findOne({ session: s._id, status: 'at_counter' }).select('buyerName'),
        s.pinnedProduct ? Product.findById(s.pinnedProduct).select('name') : null,
      ]);
      const presence = presenceOf(s.id);
      return {
        id: s.id,
        store: s.store ? { id: s.store.id, name: s.store.name, slug: s.store.slug, logo: s.store.logo, brandColor: s.store.brandColor } : null,
        startedAt: s.startedAt,
        viewers: presence.viewerCount,
        sellerHere: presence.sellerHere,
        peakViewers: Math.max(s.peakViewers, presence.viewerCount),
        waiting,
        counterBuyer: counter?.buyerName ?? null,
        pinned: pinned?.name ?? null,
        totalSales: s.totalSales,
      };
    }),
  );
  ok(res, { rooms });
}

// POST /api/admin/rooms/:sessionId/watch — hidden, watch-only video token
export async function watchRoom(req, res) {
  const session = await loadLiveSession(req.params.sessionId);
  const store = await Store.findById(session.store).select('name slug logo brandColor description departments wings openingHours isLive');
  const livekit = await createRoomToken({
    room: session.livekitRoom,
    identity: `admin_${req.user.id}`,
    name: 'Meet2buy',
    role: 'observer',
  });
  const products = await Product.find({ store: session.store, isVisible: true }).sort({ createdAt: -1 });
  ok(res, { livekit, session: { id: session.id, startedAt: session.startedAt, totalSales: session.totalSales }, store, products });
}

// POST /api/admin/rooms/:sessionId/close { reason? }
export async function closeRoom(req, res) {
  const session = await loadLiveSession(req.params.sessionId);
  await endSession(session._id, 'admin');
  const store = await Store.findById(session.store).select('owner name');
  if (store) {
    notifyUser(store.owner, {
      type: 'room_closed',
      title: 'Meet2buy closed your live room',
      body: req.body?.reason ? `Reason: ${req.body.reason}` : 'Contact Meet2buy support if you have questions.',
      link: '/seller/live',
    });
  }
  ok(res, null);
}

// ---- Transactions ----

// GET /api/admin/transactions?status=&store=&q=&from=&to=
export async function transactions(req, res) {
  const filter = {};
  const { status, store, q, from, to } = req.query;
  if (typeof status === 'string' && status) filter.status = status === 'sold' ? { $in: SOLD } : status;
  if (typeof store === 'string' && /^[a-f\d]{24}$/i.test(store)) filter.store = store;
  if (typeof q === 'string' && q.trim()) filter.orderNumber = { $regex: escapeRegex(q.trim().toUpperCase()) };
  if (from || to) {
    filter.createdAt = {};
    if (from && !Number.isNaN(Date.parse(from))) filter.createdAt.$gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) filter.createdAt.$lte = new Date(new Date(to).getTime() + 86_400_000);
  }
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(200).populate('buyer', 'name phone').populate('store', 'name slug');
  const [payments, payouts] = await Promise.all([
    Payment.find({ _id: { $in: orders.map((o) => o.payment) } }).select('status mpesaReceipt phone paidAmount resultDesc'),
    Payout.find({ order: { $in: orders.map((o) => o._id) } }).select('order status amount resultDesc transactionId'),
  ]);
  const paymentOf = new Map(payments.map((p) => [p.id, p]));
  const payoutOf = new Map(payouts.map((p) => [p.order.toString(), p]));
  const totals = orders.filter((o) => SOLD.includes(o.status)).reduce(
    (t, o) => ({ sales: t.sales + o.amount, commission: t.commission + (o.commissionAmount ?? 0) }),
    { sales: 0, commission: 0 },
  );
  ok(res, {
    totals,
    orders: orders.map((o) => {
      const p = paymentOf.get(o.payment?.toString());
      const po = payoutOf.get(o.id);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        holdReason: o.holdReason,
        adminNote: o.adminNote,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
        amount: o.amount,
        commissionRate: o.commissionRate,
        commissionAmount: o.commissionAmount,
        payoutAmount: o.payoutAmount,
        items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, variant: i.variant })),
        buyer: o.buyer ? { name: o.buyer.name, phone: o.buyer.phone } : null,
        store: o.store ? { id: o.store.id, name: o.store.name, slug: o.store.slug } : null,
        payment: p ? { status: p.status, receipt: p.mpesaReceipt, phone: p.phone, paidAmount: p.paidAmount, message: p.resultDesc } : null,
        payout: po ? { id: po.id, status: po.status, amount: po.amount, transactionId: po.transactionId, message: po.resultDesc } : null,
      };
    }),
  });
}

// POST /api/admin/orders/:id/resolve { action: pay | cancel, note }
// For orders on hold (amount mismatch, late or unconfirmed payment) after the admin has checked the M-Pesa statement.
export async function resolveOrder(req, res) {
  const order = await Order.findOne({ _id: req.params.id, status: 'on_hold' });
  if (!order) throw new AppError(409, 'Only orders on hold can be resolved here');
  const note = req.body.note;

  if (req.body.action === 'cancel') {
    await releaseStock(order._id);
    order.status = 'cancelled';
    order.adminNote = note;
    await order.save();
    return ok(res, { order: { id: order.id, status: order.status } });
  }

  // Pay the seller: only with a real M-Pesa receipt on file (doc 08 rule 2).
  const payment = await Payment.findById(order.payment);
  if (!payment?.mpesaReceipt) throw new AppError(409, 'There is no M-Pesa receipt for this order, so the seller cannot be paid');
  if (order.stockReleased) {
    // Late payment after the order was cancelled: the stock went back, take it again if it is still there.
    const items = order.items;
    for (const i of items) {
      const took = await Product.updateOne({ _id: i.product, stock: { $gte: i.quantity } }, { $inc: { stock: -i.quantity } });
      if (took.modifiedCount !== 1) throw new AppError(409, `${i.name} is out of stock now. Refund the buyer instead.`);
    }
    order.stockReleased = false;
  }
  const split = await computeSplit(order);
  Object.assign(order, { status: 'paid', paidAt: order.paidAt ?? payment.paidAt ?? new Date(), adminNote: note, ...split });
  await order.save();
  if (payment.status !== 'success') await Payment.updateOne({ _id: payment._id }, { status: 'success' });
  if (order.payoutAmount >= 1) {
    const payout = await createPayout(order);
    if (payout) await sendPayout(payout._id);
  }
  ok(res, { order: { id: order.id, status: order.status } });
}

// ---- Payouts ----

// GET /api/admin/payouts?status=
export async function payouts(req, res) {
  const filter = {};
  if (['pending', 'processing', 'completed', 'failed'].includes(req.query.status)) filter.status = req.query.status;
  const list = await Payout.find(filter).sort({ createdAt: -1 }).limit(200).populate('store', 'name slug').populate('order', 'orderNumber amount');
  const counts = Object.fromEntries((await Payout.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])).map((c) => [c._id, c.n]));
  ok(res, {
    counts,
    payouts: list.map((p) => ({
      id: p.id,
      status: p.status,
      amount: p.amount,
      destinationType: p.destinationType,
      destination: p.destination,
      accountReference: p.accountReference,
      attempts: p.attempts,
      resultDesc: p.resultDesc,
      transactionId: p.transactionId,
      lastAttemptAt: p.lastAttemptAt,
      completedAt: p.completedAt,
      timedOutAt: p.timedOutAt,
      statusCheckedAt: p.statusCheckedAt,
      wasAccepted: Boolean(p.conversationId),
      createdAt: p.createdAt,
      store: p.store ? { name: p.store.name, slug: p.store.slug } : null,
      order: p.order ? { id: p.order.id, orderNumber: p.order.orderNumber, amount: p.order.amount } : null,
    })),
  });
}

const STATUS_WAIT_MS = 60_000;

// POST /api/admin/payouts/:id/retry
// Doc 08 rule 4: if Safaricom had accepted the last attempt, first ask whether it really failed (no double payment).
export async function retryPayout(req, res) {
  const payout = await Payout.findById(req.params.id);
  if (!payout) throw new AppError(404, 'Payout not found');
  if (payout.status !== 'failed') throw new AppError(409, 'Only failed payouts can be retried');

  const store = await Store.findById(payout.store).select('+payout status');
  if (!store?.payout?.verified) throw new AppError(409, 'The seller changed their payout number. Verify it in Sellers first.');

  const accepted = Boolean(payout.conversationId) && !isSimulated();
  const checkedSinceLastTry = payout.statusCheckedAt && payout.statusCheckedAt > (payout.lastAttemptAt ?? 0);
  if (accepted && !checkedSinceLastTry) {
    await transactionStatus({ originatorConversationId: payout.originatorConversationId, relatedId: payout._id }).catch(() => {});
    payout.statusCheckedAt = new Date();
    await payout.save();
    return res.status(202).json({
      success: true,
      data: { checking: true, message: 'Checking with M-Pesa that the last attempt did not go through. Try again in a minute.' },
    });
  }
  if (accepted && Date.now() - payout.statusCheckedAt.getTime() < STATUS_WAIT_MS) {
    throw new AppError(409, 'Still waiting for M-Pesa to answer the status check. Try again in a minute.');
  }

  // Use the seller's current (verified) details.
  const p = store.payout;
  const till = p.type === 'till';
  const reset = await Payout.findOneAndUpdate(
    { _id: payout._id, status: 'failed' },
    {
      status: 'pending',
      destinationType: p.type,
      destination: till ? p.tillNumber : p.paybillNumber,
      ...(till ? {} : { accountReference: p.accountNumber || payout.accountReference }),
      conversationId: null,
      originatorConversationId: null,
      timedOutAt: null,
    },
    { returnDocument: 'after' },
  );
  if (!reset) throw new AppError(409, 'This payout changed meanwhile. Refresh and try again.');
  const sent = await sendPayout(reset._id);
  ok(res, { payout: { id: sent.id, status: sent.status, resultDesc: sent.resultDesc } });
}

// ---- Settings & commission ----

const SETTINGS_FIELDS = ['defaultCommissionRate', 'deductPayoutFeeFromSeller', 'payoutFee', 'offerExpiryMinutes', 'counterTimeLimitMinutes'];
const settingsView = (s) => Object.fromEntries(SETTINGS_FIELDS.map((k) => [k, s[k]]));

// GET /api/admin/settings
export async function getSettings(_req, res) {
  ok(res, { settings: settingsView(await Settings.getGlobal()) });
}

// PATCH /api/admin/settings
export async function updateSettings(req, res) {
  const s = await Settings.getGlobal();
  for (const k of SETTINGS_FIELDS) if (req.body[k] !== undefined) s[k] = req.body[k];
  await s.save();
  ok(res, { settings: settingsView(s) });
}

// PATCH /api/admin/sellers/:storeId/commission { rate: number | null }
export async function setCommission(req, res) {
  const store = await Store.findByIdAndUpdate(req.params.storeId, { commissionRate: req.body.rate }, { returnDocument: 'after' });
  if (!store) throw new AppError(404, 'Shop not found');
  ok(res, { store: { id: store.id, commissionRate: store.commissionRate } });
}

// ---- Users ----

// GET /api/admin/users?q=&role=
export async function users(req, res) {
  const filter = {};
  if (['buyer', 'seller', 'admin'].includes(req.query.role)) filter.role = req.query.role;
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const rx = { $regex: escapeRegex(req.query.q.trim().slice(0, 60)), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const list = await User.find(filter).sort({ createdAt: -1 }).limit(200);
  const orderCounts = Object.fromEntries(
    (await Order.aggregate([{ $match: { buyer: { $in: list.map((u) => u._id) }, status: { $in: SOLD } } }, { $group: { _id: '$buyer', n: { $sum: 1 } } }])).map(
      (c) => [c._id.toString(), c.n],
    ),
  );
  ok(res, {
    users: list.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      isGuest: u.isGuest,
      isEnvOwner: u.isEnvOwner,
      createdAt: u.createdAt,
      orders: orderCounts[u.id] ?? 0,
    })),
  });
}

// PATCH /api/admin/users/:id/suspend { suspended: boolean }
export async function suspendUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, 'User not found');
  if (user.isEnvOwner) throw new AppError(403, 'The owner admin cannot be suspended');
  if (user._id.equals(req.user._id)) throw new AppError(400, 'You cannot suspend yourself');
  user.status = req.body.suspended ? 'suspended' : 'active';
  await user.save();
  ok(res, { user: { id: user.id, status: user.status } });
}
