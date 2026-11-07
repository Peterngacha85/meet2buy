import { Router } from 'express';
import { z } from 'zod';
import * as admin from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { allow } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import { objectId, rejectSchema, suspendSchema } from '../validators/storeValidators.js';

const router = Router();
router.use(protect, allow('admin'));

const storeIdParam = validate(z.object({ storeId: objectId('shop') }), 'params');

router.get('/sellers', admin.listSellers);
router.patch('/sellers/:storeId/approve', storeIdParam, admin.approve);
router.patch('/sellers/:storeId/reject', storeIdParam, validate(rejectSchema), admin.reject);
router.patch('/sellers/:storeId/suspend', storeIdParam, validate(suspendSchema), admin.suspend);
router.patch('/sellers/:storeId/reinstate', storeIdParam, admin.reinstate);

export default router;
