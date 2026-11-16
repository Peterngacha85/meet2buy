import { Product } from '../models/Product.js';
import { Store, publicStore } from '../models/Store.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/respond.js';

function assertDepartment(store, departmentId) {
  if (!store.departments.id(departmentId)) {
    throw new AppError(400, 'Choose one of your departments', [{ field: 'department', message: 'Choose one of your departments' }]);
  }
}

/** Keep each variation's id across edits: open orders point at it to give stock back. */
function body(input) {
  if (!input.skus) return input;
  return { ...input, skus: input.skus.map(({ id, ...sku }) => (id ? { _id: id, ...sku } : sku)) };
}

async function findOwnProduct(req) {
  const product = await Product.findOne({ _id: req.params.id, store: req.store._id });
  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

// GET /api/products/mine
export async function listMine(req, res) {
  const products = await Product.find({ store: req.store._id }).sort({ createdAt: -1 });
  ok(res, { products });
}

// POST /api/products
export async function create(req, res) {
  assertDepartment(req.store, req.body.department);
  const product = await Product.create({ ...body(req.body), store: req.store._id });
  ok(res, { product }, 201);
}

// PATCH /api/products/:id
export async function update(req, res) {
  const product = await findOwnProduct(req);
  if (req.body.department) assertDepartment(req.store, req.body.department);
  const changes = body(req.body);
  // Removing every option removes the variations too.
  if (changes.variants?.length === 0 && !changes.skus) changes.skus = [];
  product.set(changes);
  await product.save();
  ok(res, { product });
}

// DELETE /api/products/:id
export async function remove(req, res) {
  const product = await findOwnProduct(req);
  await product.deleteOne();
  ok(res, null);
}

const CATALOGUE_LIMIT = 2000;

// GET /api/products — every visible SKU in every open shop (the mall directory lists them per brand)
export async function listPublic(_req, res) {
  const openStores = await Store.find({ status: 'approved' }).select('_id');
  const products = await Product.find({ store: { $in: openStores.map((s) => s._id) }, isVisible: true })
    .sort({ store: 1, createdAt: -1 })
    .limit(CATALOGUE_LIMIT);
  ok(res, { products });
}

// GET /api/products/:id — public product details (visible products in open shops only)
export async function getOne(req, res) {
  const product = await Product.findOne({ _id: req.params.id, isVisible: true });
  const store = product && (await Store.findOne({ _id: product.store, status: 'approved' }));
  if (!store) throw new AppError(404, 'Product not found');
  ok(res, { product, store: publicStore(store) });
}
