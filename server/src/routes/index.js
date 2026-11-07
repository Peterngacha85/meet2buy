import { Router } from 'express';
import authRoutes from './authRoutes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
router.use('/auth', authRoutes);

// Mounted in later sprints:
// router.use('/stores', storeRoutes);
// router.use('/products', productRoutes);
// router.use('/rooms', roomRoutes);
// router.use('/orders', orderRoutes);
// router.use('/mpesa', mpesaRoutes);
// router.use('/admin', adminRoutes);

export default router;
