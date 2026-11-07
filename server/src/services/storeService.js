import { Settings } from '../models/Settings.js';
import { Product } from '../models/Product.js';
import { AppError } from '../utils/AppError.js';

/**
 * Check departments against the mall's wings and keep existing department ids
 * (products point at them), so renaming a department never orphans its products.
 */
export async function resolveDepartments(input, existing = []) {
  const settings = await Settings.getGlobal();
  const wingSlugs = new Set(settings.wings.map((w) => w.slug));
  const existingIds = new Set(existing.map((d) => d._id.toString()));

  return input.map((d, i) => {
    if (!wingSlugs.has(d.wing)) {
      throw new AppError(400, 'Choose a wing from the list', [{ field: `departments.${i}.wing`, message: 'Unknown wing' }]);
    }
    if (d.id && !existingIds.has(d.id)) {
      throw new AppError(400, 'That department no longer exists', [{ field: `departments.${i}.id`, message: 'Unknown department' }]);
    }
    return d.id ? { _id: d.id, name: d.name, wing: d.wing } : { name: d.name, wing: d.wing };
  });
}

/** Refuse to delete a department that still has products in it. */
export async function assertDepartmentsRemovable(store, nextDepartments) {
  const keep = new Set(nextDepartments.filter((d) => d._id).map((d) => String(d._id)));
  const removed = store.departments.filter((d) => !keep.has(d._id.toString()));
  if (!removed.length) return;

  const inUse = await Product.distinct('department', { store: store._id, department: { $in: removed.map((d) => d._id) } });
  if (inUse.length) {
    const names = removed.filter((d) => inUse.some((id) => id.equals(d._id))).map((d) => d.name);
    throw new AppError(409, `Move or delete the products in ${names.join(', ')} before removing ${names.length > 1 ? 'these departments' : 'this department'}`);
  }
}
