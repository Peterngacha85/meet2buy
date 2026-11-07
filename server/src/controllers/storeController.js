import { Store, publicStore, privateStore } from '../models/Store.js';
import { Product } from '../models/Product.js';
import { Settings } from '../models/Settings.js';
import { PresentationRequest } from '../models/PresentationRequest.js';
import { assertDepartmentsRemovable, resolveDepartments } from '../services/storeService.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/respond.js';
import { escapeRegex } from '../utils/slug.js';

const PAGE_SIZE = 60;

// GET /api/stores/wings — the mall directory: wings with shop counts
export async function listWings(_req, res) {
  const settings = await Settings.getGlobal();
  const counts = await Store.aggregate([
    { $match: { status: 'approved' } },
    { $unwind: '$wings' },
    { $group: { _id: '$wings', shops: { $sum: 1 }, live: { $sum: { $cond: ['$isLive', 1, 0] } } } },
  ]);
  const bySlug = Object.fromEntries(counts.map((c) => [c._id, c]));
  const [shops, live] = await Promise.all([
    Store.countDocuments({ status: 'approved' }),
    Store.countDocuments({ status: 'approved', isLive: true }),
  ]);

  ok(res, {
    wings: settings.wings.map((w) => ({
      name: w.name,
      slug: w.slug,
      departments: w.departments,
      shopCount: bySlug[w.slug]?.shops ?? 0,
      liveCount: bySlug[w.slug]?.live ?? 0,
    })),
    totals: { shops, live },
  });
}

// GET /api/stores?wing=&q=&live=true&page=
export async function listStores(req, res) {
  const { wing, q, live } = req.query;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

  const filter = { status: 'approved' };
  if (typeof wing === 'string' && wing) filter.wings = wing;
  if (live === 'true') filter.isLive = true;
  if (typeof q === 'string' && q.trim()) filter.name = { $regex: escapeRegex(q.trim().slice(0, 60)), $options: 'i' };

  const [stores, total] = await Promise.all([
    Store.find(filter)
      .sort({ isLive: -1, name: 1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE),
    Store.countDocuments(filter),
  ]);

  ok(res, { stores: stores.map(publicStore), total, page, pages: Math.ceil(total / PAGE_SIZE) || 1 });
}

// GET /api/stores/:slug — shop page. The owner and admins can preview a shop before approval.
export async function getStore(req, res) {
  const store = await Store.findOne({ slug: req.params.slug });
  const isOwner = store && req.user && store.owner.equals(req.user._id);
  const canPreview = isOwner || req.user?.role === 'admin';
  if (!store || (store.status !== 'approved' && !canPreview)) {
    throw new AppError(404, 'This shop is not open in the mall');
  }

  const products = await Product.find({ store: store._id, isVisible: true }).sort({ createdAt: -1 });
  ok(res, {
    store: publicStore(store),
    products,
    preview: store.status !== 'approved' ? store.status : null,
  });
}

// GET /api/stores/mine
export function getMine(req, res) {
  ok(res, { store: privateStore(req.store) });
}

// PATCH /api/stores/mine — shop profile, signage and departments
export async function updateMine(req, res) {
  const store = req.store;
  const { departments, ...fields } = req.body;

  if (departments) {
    const next = await resolveDepartments(departments, store.departments);
    await assertDepartmentsRemovable(store, next);
    store.departments = next;
  }
  if (fields.name !== undefined && fields.name !== store.name) {
    store.name = fields.name;
    // Keep links stable once the shop is in the mall.
    if (store.status === 'pending') store.slug = await Store.uniqueSlug(fields.name, store._id);
  }
  for (const key of ['description', 'logo', 'banner', 'brandColor']) {
    if (fields[key] !== undefined) store[key] = fields[key];
  }

  await store.save();
  ok(res, { store: privateStore(store) });
}

// PATCH /api/stores/mine/payout — admin must verify the new details again
export async function updatePayout(req, res) {
  req.store.payout = { ...req.body, verified: false };
  await req.store.save();
  ok(res, { store: privateStore(req.store) });
}

// POST /api/stores/mine/resubmit — after fixing what the admin asked for
export async function resubmit(req, res) {
  if (req.store.status !== 'rejected') throw new AppError(409, 'Only a rejected shop can be sent for review again');
  req.store.status = 'pending';
  req.store.statusChangedAt = new Date();
  await req.store.save();
  ok(res, { store: privateStore(req.store) });
}

// POST /api/stores/:storeId/presentation-requests — "Ready to buy? Get a demo" while the shop is closed
export async function createPresentationRequest(req, res) {
  const store = await Store.findById(req.params.storeId);
  if (!store || store.status !== 'approved') throw new AppError(404, 'This shop is not open in the mall');
  if (store.owner.equals(req.user._id)) throw new AppError(400, 'You cannot request a demo from your own shop');

  const { product = null, message = '' } = req.body;
  let { department = null } = req.body;

  if (product) {
    const found = await Product.findOne({ _id: product, store: store._id, isVisible: true });
    if (!found) throw new AppError(404, 'That product is not in this shop');
    department = found.department.toString();
  }
  if (department && !store.departments.id(department)) throw new AppError(404, 'That department is not in this shop');

  // One open request per buyer per product: asking again just updates the note.
  const existing = await PresentationRequest.findOne({ store: store._id, buyer: req.user._id, product, status: 'open' });
  if (existing) {
    existing.message = message || existing.message;
    existing.department = department;
    await existing.save();
    return ok(res, { request: existing });
  }

  const request = await PresentationRequest.create({ store: store._id, buyer: req.user._id, product, department, message });
  ok(res, { request }, 201);
}

// GET /api/stores/mine/presentation-requests?status=open
export async function listPresentationRequests(req, res) {
  const filter = { store: req.store._id };
  if (['open', 'seen', 'closed'].includes(req.query.status)) filter.status = req.query.status;

  const requests = await PresentationRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('buyer', 'name') // name only — contact details stay on the platform (doc 02 rule 5)
    .populate('product', 'name price images');

  const depName = (id) => (id ? req.store.departments.id(id)?.name ?? null : null);
  ok(res, {
    requests: requests.map((r) => ({ ...r.toJSON(), departmentName: depName(r.department) })),
    openCount: await PresentationRequest.countDocuments({ store: req.store._id, status: 'open' }),
  });
}

// PATCH /api/stores/mine/presentation-requests/:id
export async function updatePresentationRequest(req, res) {
  const request = await PresentationRequest.findOneAndUpdate(
    { _id: req.params.id, store: req.store._id },
    { status: req.body.status },
    { returnDocument: 'after' },
  );
  if (!request) throw new AppError(404, 'Request not found');
  ok(res, { request });
}
