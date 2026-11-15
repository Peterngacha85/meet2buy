import { Router } from 'express';
import { z } from 'zod';
import * as rooms from '../controllers/roomController.js';
import { optionalAuth, protect } from '../middleware/auth.js';
import { allow } from '../middleware/roles.js';
import { requireStore } from '../middleware/store.js';
import { validate } from '../middleware/validate.js';
import { objectId } from '../validators/storeValidators.js';

const router = Router();
const seller = [protect, allow('seller'), requireStore];
const sessionParam = validate(z.object({ sessionId: objectId('room') }), 'params');

// Fixed paths first, then /:storeSlug.
router.post('/start', ...seller, rooms.start);
router.post('/end', ...seller, rooms.end);
router.get('/mine', ...seller, rooms.mine);
router.post('/:sessionId/token', sessionParam, optionalAuth, rooms.token);
router.get('/:sessionId/messages', sessionParam, rooms.messages);
router.get('/:sessionId/queue', sessionParam, protect, rooms.queue);
router.get('/:storeSlug', optionalAuth, rooms.getRoom);

export default router;
