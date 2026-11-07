import { AppError } from '../utils/AppError.js';

/** Use after protect: router.get('/x', protect, allow('seller'), handler) */
export const allow =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'You do not have permission to do this');
    }
    next();
  };
