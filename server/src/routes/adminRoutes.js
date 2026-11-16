import { Router } from 'express';
import { z } from 'zod';
import * as admin from '../controllers/adminController.js';
import * as ops from '../controllers/adminOpsController.js';
import {
  addAdminSchema,
  closeRoomSchema,
  commissionSchema,
  resolveOrderSchema,
  settingsSchema,
  suspendUserSchema,
} from '../validators/adminValidators.js';
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
router.patch('/sellers/:storeId/commission', storeIdParam, validate(commissionSchema), ops.setCommission);

const sessionParam = validate(z.object({ sessionId: objectId('room') }), 'params');
const idParam = validate(z.object({ id: objectId() }), 'params');

router.get('/stats', ops.stats);
router.get('/rooms/live', ops.liveRooms);
router.post('/rooms/:sessionId/watch', sessionParam, ops.watchRoom);
router.post('/rooms/:sessionId/close', sessionParam, validate(closeRoomSchema), ops.closeRoom);
router.get('/transactions', ops.transactions);
router.post('/orders/:id/resolve', idParam, validate(resolveOrderSchema), ops.resolveOrder);
router.get('/payouts', ops.payouts);
router.post('/payouts/:id/retry', idParam, ops.retryPayout);
router.get('/settings', ops.getSettings);
router.patch('/settings', validate(settingsSchema), ops.updateSettings);
router.get('/users', ops.users);
router.patch('/users/:id/suspend', idParam, validate(suspendUserSchema), ops.suspendUser);
router.get('/admins', ops.listAdmins);
router.post('/admins', validate(addAdminSchema), ops.addAdmin);
router.delete('/admins/:id', idParam, ops.removeAdmin);

export default router;
