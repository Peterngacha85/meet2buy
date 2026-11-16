import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadSignatureSchema } from '../validators/storeValidators.js';
import * as uploads from '../controllers/uploadController.js';
import authRoutes from './authRoutes.js';
import storeRoutes from './storeRoutes.js';
import productRoutes from './productRoutes.js';
import adminRoutes from './adminRoutes.js';
import roomRoutes from './roomRoutes.js';
import orderRoutes from './orderRoutes.js';
import mpesaRoutes from './mpesaRoutes.js';
import supportRoutes from './supportRoutes.js';
import { announces } from '../services/liveService.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
router.use('/auth', announces('users', 'sellers'), authRoutes);
router.use('/stores', announces('store', 'requests', 'sellers', 'mall'), storeRoutes);
router.use('/products', announces('products', 'mall'), productRoutes);
// Buyers may upload only after-sales photos; shop images are for sellers and admins.
router.post('/uploads/signature', protect, validate(uploadSignatureSchema), uploads.signature);
router.use('/admin', announces('sellers', 'store', 'orders', 'payouts', 'rooms', 'users', 'settings', 'mall'), adminRoutes);
router.use('/rooms', announces('rooms', 'mall', 'store'), roomRoutes);
router.use('/orders', announces('orders'), orderRoutes);
router.use('/mpesa', mpesaRoutes);
router.use('/support', announces('support'), supportRoutes);

export default router;
