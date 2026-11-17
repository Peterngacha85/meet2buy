import { env } from '../config/env.js';
import { logMpesa } from '../models/Commerce.js';
import { applyStkResult, parseStkCallback } from '../services/orderService.js';
import { applyB2BResult, applyB2BTimeout, applyStatusResult } from '../services/payoutService.js';
import { logger } from '../utils/logger.js';
import { changed } from '../services/liveService.js';

// Called by Safaricom (doc 06 /api/pay). Rule 7: answer 200 at once, then process.
// Rule 5: every callback is logged raw first.

const ACCEPTED = { ResultCode: 0, ResultDesc: 'Accepted' };

function handle(type, process) {
  return async (req, res) => {
    const body = req.body ?? {};
    // Our callback URLs carry ?t=<MPESA_CALLBACK_TOKEN>; anything else is not from Safaricom.
    if (env.MPESA_CALLBACK_TOKEN && req.query.t !== env.MPESA_CALLBACK_TOKEN) {
      logger.warn(`rejected ${type} callback with a wrong token from ${req.ip}`);
      return res.json(ACCEPTED);
    }
    res.json(ACCEPTED);
    await logMpesa(type, 'in', body);
    try {
      await process(body);
    } catch (err) {
      logger.error(`${type} processing failed`, err);
    }
    // We answered Safaricom before processing, so announce only now that the order/payout has moved.
    changed('orders', 'payouts');
  };
}

export const stkCallback = handle('stk_callback', async (body) => {
  const result = parseStkCallback(body);
  if (result) await applyStkResult(result);
});
export const b2bResult = handle('b2b_result', applyB2BResult);
export const b2bTimeout = handle('b2b_timeout', applyB2BTimeout);
export const statusResult = handle('status_result', applyStatusResult);
export const statusTimeout = handle('status_timeout', async () => {});
