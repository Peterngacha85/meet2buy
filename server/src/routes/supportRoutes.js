import { Router } from 'express';
import { z } from 'zod';
import * as support from '../controllers/supportController.js';
import { protect } from '../middleware/auth.js';
import { allow } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import { objectId } from '../validators/storeValidators.js';
import { messageSchema, openTicketSchema, ticketStatusSchema } from '../validators/supportValidators.js';

const router = Router();
const idParam = validate(z.object({ id: objectId('request') }), 'params');

router.use(protect);
router.post('/', validate(openTicketSchema), support.create);
router.get('/', allow('admin'), support.all);
router.get('/mine', support.mine);
router.get('/store', allow('seller'), support.forStore);
router.get('/:id', idParam, support.show);
router.post('/:id/messages', idParam, validate(messageSchema), support.reply);
router.patch('/:id/status', idParam, validate(ticketStatusSchema), support.status);

export default router;
