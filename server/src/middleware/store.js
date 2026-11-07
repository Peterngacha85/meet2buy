import { Store } from '../models/Store.js';
import { AppError } from '../utils/AppError.js';

/** Use after protect + allow('seller'). Sets req.store (with payout details). */
export async function requireStore(req, _res, next) {
  const store = await Store.findOne({ owner: req.user._id }).select('+payout');
  if (!store) throw new AppError(404, 'You have not opened a shop yet');
  req.store = store;
  next();
}
