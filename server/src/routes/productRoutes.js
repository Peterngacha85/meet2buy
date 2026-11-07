import { Router } from 'express';
import { z } from 'zod';
import * as products from '../controllers/productController.js';
import { protect } from '../middleware/auth.js';
import { allow } from '../middleware/roles.js';
import { requireStore } from '../middleware/store.js';
import { validate } from '../middleware/validate.js';
import { createProductSchema, objectId, updateProductSchema } from '../validators/storeValidators.js';

const router = Router();
const seller = [protect, allow('seller'), requireStore];
const idParam = validate(z.object({ id: objectId('product') }), 'params');

router.get('/mine', ...seller, products.listMine);
router.post('/', ...seller, validate(createProductSchema), products.create);
router.get('/:id', idParam, products.getOne);
router.patch('/:id', ...seller, idParam, validate(updateProductSchema), products.update);
router.delete('/:id', ...seller, idParam, products.remove);

export default router;
