import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema, updateMeSchema } from '../validators/authValidators.js';
import { registerSellerSchema } from '../validators/storeValidators.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), auth.register);
router.post('/register-seller', authLimiter, validate(registerSellerSchema), auth.registerSeller);
router.post('/login', authLimiter, validate(loginSchema), auth.login);
router.post('/logout', auth.logout);
router.get('/me', protect, auth.me);
router.patch('/me', protect, validate(updateMeSchema), auth.updateMe);

export default router;
