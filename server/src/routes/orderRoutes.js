import { Router } from 'express';
import { z } from 'zod';
import * as orders from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';
import { allow } from '../middleware/roles.js';
import { requireStore } from '../middleware/store.js';
import { validate } from '../middleware/validate.js';
import { checkoutLimiter } from '../middleware/rateLimit.js';
import { objectId } from '../validators/storeValidators.js';
import { checkoutSchema, fulfilmentSchema, simulateSchema } from '../validators/orderValidators.js';

const router = Router();
const seller = [protect, allow('seller'), requireStore];
const idParam = validate(z.object({ id: objectId('order') }), 'params');

router.post('/checkout', protect, checkoutLimiter, validate(checkoutSchema), orders.checkout);
router.get('/mine', protect, orders.mine);
router.get('/store', ...seller, orders.storeOrders);
router.get('/:id/status', idParam, protect, orders.status);
router.patch('/:id/fulfilment', idParam, ...seller, validate(fulfilmentSchema), orders.fulfilment);
router.post('/:id/simulate', idParam, protect, validate(simulateSchema), orders.simulate);

export default router;
