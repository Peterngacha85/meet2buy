import { Router } from 'express';
import * as stores from '../controllers/storeController.js';
import { optionalAuth, protect } from '../middleware/auth.js';
import { allow } from '../middleware/roles.js';
import { requireStore } from '../middleware/store.js';
import { validate } from '../middleware/validate.js';
import {
  objectId,
  payoutSchema,
  presentationRequestSchema,
  requestStatusSchema,
  updateStoreSchema,
} from '../validators/storeValidators.js';
import { z } from 'zod';

const router = Router();
const seller = [protect, allow('seller'), requireStore];
const storeIdParam = validate(z.object({ storeId: objectId('shop') }), 'params');
const idParam = validate(z.object({ id: objectId('request') }), 'params');

// Fixed paths first, then /:slug (doc 06 route-order note).
router.get('/', stores.listStores);
router.get('/wings', stores.listWings);

router.get('/mine', ...seller, stores.getMine);
router.patch('/mine', ...seller, validate(updateStoreSchema), stores.updateMine);
router.patch('/mine/payout', ...seller, validate(payoutSchema), stores.updatePayout);
router.post('/mine/resubmit', ...seller, stores.resubmit);
router.get('/mine/presentation-requests', ...seller, stores.listPresentationRequests);
router.patch('/mine/presentation-requests/:id', ...seller, idParam, validate(requestStatusSchema), stores.updatePresentationRequest);

router.post('/:storeId/presentation-requests', protect, storeIdParam, validate(presentationRequestSchema), stores.createPresentationRequest);
router.get('/:slug', optionalAuth, stores.getStore);

export default router;
