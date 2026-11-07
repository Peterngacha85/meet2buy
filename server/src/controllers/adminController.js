import { Store, privateStore } from '../models/Store.js';
import { Product } from '../models/Product.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/respond.js';

const withOwner = (store) => ({
  ...privateStore(store),
  ownerInfo: store.owner?.email
    ? { id: store.owner._id.toString(), name: store.owner.name, email: store.owner.email, phone: store.owner.phone }
    : null,
});

async function loadStore(id) {
  const store = await Store.findById(id).select('+payout').populate('owner', 'name email phone');
  if (!store) throw new AppError(404, 'Shop not found');
  return store;
}

function setStatus(store, status, reason = null) {
  store.status = status;
  store.rejectionReason = reason;
  store.statusChangedAt = new Date();
}

// GET /api/admin/sellers?status=pending
export async function listSellers(req, res) {
  const filter = {};
  if (['pending', 'approved', 'rejected', 'suspended'].includes(req.query.status)) filter.status = req.query.status;

  const [stores, counts] = await Promise.all([
    Store.find(filter).select('+payout').populate('owner', 'name email phone').sort({ createdAt: -1 }).limit(500),
    Store.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const productCounts = await Product.aggregate([
    { $match: { store: { $in: stores.map((s) => s._id) } } },
    { $group: { _id: '$store', n: { $sum: 1 } } },
  ]);
  const productsBy = Object.fromEntries(productCounts.map((c) => [c._id.toString(), c.n]));

  ok(res, {
    sellers: stores.map((s) => ({ ...withOwner(s), productCount: productsBy[s._id.toString()] ?? 0 })),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
  });
}

// PATCH /api/admin/sellers/:storeId/approve — also (re)verifies payout details
export async function approve(req, res) {
  const store = await loadStore(req.params.storeId);
  if (store.status === 'suspended') throw new AppError(409, 'Reinstate a suspended shop instead');
  setStatus(store, 'approved');
  store.payout.verified = true;
  await store.save();
  ok(res, { seller: withOwner(store) });
}

// PATCH /api/admin/sellers/:storeId/reject { reason }
export async function reject(req, res) {
  const store = await loadStore(req.params.storeId);
  if (store.status !== 'pending') throw new AppError(409, 'Only shops waiting for review can be rejected');
  setStatus(store, 'rejected', req.body.reason);
  await store.save();
  ok(res, { seller: withOwner(store) });
}

// PATCH /api/admin/sellers/:storeId/suspend { reason? } — the shop leaves the mall at once
export async function suspend(req, res) {
  const store = await loadStore(req.params.storeId);
  if (store.status !== 'approved') throw new AppError(409, 'Only open shops can be suspended');
  setStatus(store, 'suspended', req.body.reason || null);
  store.isLive = false; // Sprint 4: also end the live room session
  await store.save();
  ok(res, { seller: withOwner(store) });
}

// PATCH /api/admin/sellers/:storeId/reinstate
export async function reinstate(req, res) {
  const store = await loadStore(req.params.storeId);
  if (store.status !== 'suspended') throw new AppError(409, 'This shop is not suspended');
  setStatus(store, 'approved');
  await store.save();
  ok(res, { seller: withOwner(store) });
}
