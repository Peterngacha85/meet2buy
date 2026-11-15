import { Router } from 'express';
import * as mpesa from '../controllers/mpesaController.js';

// Called by Safaricom; no login. Protected by the ?t= token when MPESA_CALLBACK_TOKEN is set.
const router = Router();

router.post('/stk/callback', mpesa.stkCallback);
router.post('/b2b/result', mpesa.b2bResult);
router.post('/b2b/timeout', mpesa.b2bTimeout);
router.post('/status/result', mpesa.statusResult);
router.post('/status/timeout', mpesa.statusTimeout);

export default router;
