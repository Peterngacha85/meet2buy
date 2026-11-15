import crypto from 'node:crypto';
import { Order, Payment, Payout } from '../models/Commerce.js';
import { Store } from '../models/Store.js';
import { User } from '../models/User.js';
import { applyStkResult, checkout as runCheckout, resolvePending } from '../services/orderService.js';
import { isSimulated } from '../services/mpesa.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/respond.js';

const STATUS_QUERY_AFTER_MS = 90_000;
const SELLER_VISIBLE = ['paid', 'on_hold', 'shipped', 'delivered'];

/** What the buyer sees. The seller's phone appears only once the order is paid (doc 02 rule 5). */
async function buyerView(order) {
  const [store, payment] = await Promise.all([
    Store.findById(order.store).select('name slug logo brandColor owner'),
    Payment.findById(order.payment).select('status mpesaReceipt resultDesc phone'),
  ]);
  const paid = ['paid', 'shipped', 'delivered'].includes(order.status);
  const owner = paid && store ? await User.findById(store.owner).select('phone') : null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    items: order.items,
    amount: order.amount,
    delivery: order.delivery,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    store: store ? { name: store.name, slug: store.slug, logo: store.logo, brandColor: store.brandColor, phone: owner?.phone ?? null } : null,
    payment: payment ? { status: payment.status, receipt: payment.mpesaReceipt, message: payment.resultDesc, phone: payment.phone } : null,
  };
}

// POST /api/orders/checkout
export async function checkout(req, res) {
  const { order, simulated } = await runCheckout(req.user, req.body);
  ok(res, { order: await buyerView(order), simulated }, 201);
}

async function loadOwnOrder(req) {
  const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id }).catch(() => null);
  if (!order) throw new AppError(404, 'Order not found');
  return order;
}

// GET /api/orders/:id/status — fallback when the socket drops; asks M-Pesa if the callback is late
export async function status(req, res) {
  let order = await loadOwnOrder(req);
  if (order.status === 'awaiting_payment') {
    const payment = await Payment.findById(order.payment).select('createdAt lastQueriedAt');
    const now = Date.now();
    const old = payment && now - payment.createdAt.getTime() > STATUS_QUERY_AFTER_MS;
    const notRecent = !payment?.lastQueriedAt || now - payment.lastQueriedAt.getTime() > 30_000;
    if (old && notRecent) {
      await resolvePending(order._id);
      order = await Order.findById(order._id);
    }
  }
  ok(res, { order: await buyerView(order) });
}

// GET /api/orders/mine
export async function mine(req, res) {
  const orders = await Order.find({ buyer: req.user._id, status: { $ne: 'awaiting_payment' } }).sort({ createdAt: -1 }).limit(100);
  ok(res, { orders: await Promise.all(orders.map(buyerView)) });
}

// GET /api/orders/store — the seller's paid orders with delivery details, commission and payout status
export async function storeOrders(req, res) {
  const orders = await Order.find({ store: req.store._id, status: { $in: SELLER_VISIBLE } })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('buyer', 'name');
  const [payments, payouts] = await Promise.all([
    Payment.find({ _id: { $in: orders.map((o) => o.payment) } }).select('mpesaReceipt'),
    Payout.find({ order: { $in: orders.map((o) => o._id) } }).select('order status amount transactionId resultDesc'),
  ]);
  const receipt = new Map(payments.map((p) => [p.id, p.mpesaReceipt]));
  const payoutFor = new Map(payouts.map((p) => [p.order.toString(), p]));
  ok(res, {
    orders: orders.map((o) => {
      const p = payoutFor.get(o.id);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        holdReason: o.holdReason,
        items: o.items,
        amount: o.amount,
        commissionRate: o.commissionRate,
        commissionAmount: o.commissionAmount,
        payoutFee: o.payoutFee,
        payoutAmount: o.payoutAmount,
        buyer: { name: o.buyer?.name ?? 'Deleted account' },
        delivery: o.delivery,
        receipt: receipt.get(o.payment?.toString()) ?? null,
        payout: p ? { status: p.status, amount: p.amount, transactionId: p.transactionId } : null,
        paidAt: o.paidAt,
        createdAt: o.createdAt,
      };
    }),
  });
}

// PATCH /api/orders/:id/fulfilment { status: shipped | delivered }
export async function fulfilment(req, res) {
  const allowedFrom = req.body.status === 'shipped' ? ['paid'] : ['paid', 'shipped'];
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, store: req.store._id, status: { $in: allowedFrom } },
    { status: req.body.status, fulfilledAt: new Date() },
    { returnDocument: 'after' },
  ).catch(() => null);
  if (!order) throw new AppError(409, 'This order cannot be marked that way');
  ok(res, { order: { id: order.id, status: order.status } });
}

// POST /api/orders/:id/simulate { action: pay | cancel } — only with MPESA_SIMULATE=true (no real money)
export async function simulate(req, res) {
  if (!isSimulated()) throw new AppError(404, 'Not found');
  const order = await loadOwnOrder(req);
  const payment = await Payment.findById(order.payment);
  if (!payment?.checkoutRequestId || payment.status !== 'pending') throw new AppError(409, 'This payment is already settled');
  const pay = req.body.action === 'pay';
  await applyStkResult({
    checkoutRequestId: payment.checkoutRequestId,
    resultCode: pay ? 0 : 1032,
    resultDesc: pay ? 'The service request is processed successfully. (simulated)' : 'Request cancelled by user (simulated)',
    amount: pay ? payment.amount : null,
    receipt: pay ? `SIM${crypto.randomBytes(4).toString('hex').toUpperCase()}` : null,
    phone: payment.phone,
  });
  ok(res, { order: await buyerView(await Order.findById(order._id)) });
}
