import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { optionalAuth, protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  deleteMeSchema,
  googleSchema,
  guestSchema,
  loginSchema,
  registerSchema,
  saveGuestSchema,
  updateMeSchema,
} from '../validators/authValidators.js';
import { registerSellerSchema } from '../validators/storeValidators.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), auth.register);
router.post('/register-seller', authLimiter, validate(registerSellerSchema), auth.registerSeller);
router.post('/login', authLimiter, validate(loginSchema), auth.login);
router.post('/google', authLimiter, validate(googleSchema), auth.googleLogin);
router.get('/config', auth.config);
router.post('/guest', authLimiter, optionalAuth, validate(guestSchema), auth.guest);
router.post('/guest/save', authLimiter, protect, validate(saveGuestSchema), auth.saveGuest);
router.post('/logout', auth.logout);
router.get('/me', protect, auth.me);
router.get('/badges', protect, auth.badges);
router.patch('/me', protect, validate(updateMeSchema), auth.updateMe);
router.delete('/me', authLimiter, protect, validate(deleteMeSchema), auth.deleteMe);

export default router;
