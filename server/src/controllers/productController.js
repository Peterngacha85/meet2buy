import { Product } from '../models/Product.js';
import { Store, publicStore } from '../models/Store.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/respond.js';

function assertDepartment(store, departmentId) {
  if (!store.departments.id(departmentId)) {
    throw new AppError(400, 'Choose one of your departments', [{ field: 'department', message: 'Choose one of your departments' }]);
  }
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
  const product = await Product.create({ ...req.body, store: req.store._id });
  ok(res, { product }, 201);
}

// PATCH /api/products/:id
export async function update(req, res) {
  const product = await findOwnProduct(req);
  if (req.body.department) assertDepartment(req.store, req.body.department);
  product.set(req.body);
  await product.save();
  ok(res, { product });
}

// DELETE /api/products/:id
export async function remove(req, res) {
  const product = await findOwnProduct(req);
  await product.deleteOne();
  ok(res, null);
}

// GET /api/products/:id — public product details (visible products in open shops only)
export async function getOne(req, res) {
  const product = await Product.findOne({ _id: req.params.id, isVisible: true });
  const store = product && (await Store.findOne({ _id: product.store, status: 'approved' }));
  if (!store) throw new AppError(404, 'Product not found');
  ok(res, { product, store: publicStore(store) });
}
