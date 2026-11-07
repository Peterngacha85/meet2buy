import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { allow } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import { uploadSignatureSchema } from '../validators/storeValidators.js';
import * as uploads from '../controllers/uploadController.js';
import authRoutes from './authRoutes.js';
import storeRoutes from './storeRoutes.js';
import productRoutes from './productRoutes.js';
import adminRoutes from './adminRoutes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
router.use('/auth', authRoutes);
router.use('/stores', storeRoutes);
router.use('/products', productRoutes);
router.post('/uploads/signature', protect, allow('seller', 'admin'), validate(uploadSignatureSchema), uploads.signature);
router.use('/admin', adminRoutes);

// Mounted in later sprints:
// router.use('/rooms', roomRoutes);
// router.use('/orders', orderRoutes);
// router.use('/mpesa', mpesaRoutes);

export default router;
