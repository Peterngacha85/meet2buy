import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logMpesa } from '../models/Commerce.js';
import { AppError } from '../utils/AppError.js';

// Safaricom Daraja client (doc 08 §5–6): OAuth, STK push + query, B2B, transaction status.
// With MPESA_SIMULATE=true and no keys, every call is answered locally instead (no money moves).

const BASE = env.MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

export const isSimulated = () => env.MPESA_SIMULATE;

export const isStkConfigured = () =>
  isSimulated() ||
  Boolean(env.MPESA_CONSUMER_KEY && env.MPESA_CONSUMER_SECRET && env.MPESA_SHORTCODE && env.MPESA_PASSKEY && env.API_PUBLIC_URL);

export const isB2BConfigured = () =>
  isSimulated() || Boolean(isStkConfigured() && env.MPESA_INITIATOR_NAME && env.MPESA_SECURITY_CREDENTIAL);

export class MpesaError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

/** Our callback URL for a Daraja route, with the shared secret when one is set. */
export function callbackUrl(path) {
  const url = `${env.API_PUBLIC_URL?.replace(/\/$/, '')}/api/pay/${path}`;
  return env.MPESA_CALLBACK_TOKEN ? `${url}?t=${encodeURIComponent(env.MPESA_CALLBACK_TOKEN)}` : url;
}

/** Daraja timestamps are Nairobi time (UTC+3), YYYYMMDDHHmmss. */
export function timestamp(date = new Date()) {
  return new Date(date.getTime() + 3 * 3600_000).toISOString().replace(/\D/g, '').slice(0, 14);
}

let tokenCache = { token: null, expiresAt: 0 };

async function accessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const basic = Buffer.from(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    await logMpesa('oauth', 'in', { status: res.status, body });
    throw new MpesaError('Could not sign in to M-Pesa', body);
  }
  // Refresh a minute early.
  tokenCache = { token: body.access_token, expiresAt: Date.now() + (Number(body.expires_in) - 60) * 1000 };
  return tokenCache.token;
}

async function post(path, payload, type, relatedId) {
  // Never log the security credential or STK password.
  const { SecurityCredential, Password, ...safe } = payload;
  await logMpesa(type, 'out', safe, relatedId);
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  await logMpesa(type, 'in', { status: res.status, body }, relatedId);
  if (!res.ok || (body.ResponseCode !== undefined && String(body.ResponseCode) !== '0')) {
    throw new MpesaError(body.errorMessage || body.ResponseDescription || `M-Pesa request failed (${res.status})`, body);
  }
  return body;
}

// ---- Simulator ----

const fakeId = (prefix) => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
// Lets the B2B simulator post its "result" back through the same code path as a real callback.
let simulatedB2BResult = null;
export const onSimulatedB2BResult = (fn) => {
  simulatedB2BResult = fn;
};

// ---- API ----

/** Ask the buyer's phone for their PIN. Returns { MerchantRequestID, CheckoutRequestID }. */
export async function stkPush({ phone, amount, accountReference, description, relatedId }) {
  if (isSimulated()) {
    const res = { MerchantRequestID: fakeId('sim_mr'), CheckoutRequestID: fakeId('sim_ws_CO'), ResponseCode: '0', simulated: true };
    await logMpesa('stk_push', 'out', { simulated: true, phone, amount, accountReference }, relatedId);
    return res;
  }
  const ts = timestamp();
  return post(
    '/mpesa/stkpush/v1/processrequest',
    {
      BusinessShortCode: env.MPESA_SHORTCODE,
      Password: Buffer.from(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${ts}`).toString('base64'),
      Timestamp: ts,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: callbackUrl('stk/callback'),
      AccountReference: accountReference.slice(0, 12),
      TransactionDesc: (description || 'Meet2buy order').slice(0, 13),
    },
    'stk_push',
    relatedId,
  );
}

/**
 * Final status of an STK push when the callback is late. Returns { done, resultCode, resultDesc }:
 * done=false while the buyer may still be entering their PIN.
 */
export async function stkQuery(checkoutRequestId, relatedId) {
  if (isSimulated()) return { done: false };
  const ts = timestamp();
  try {
    const body = await post(
      '/mpesa/stkpushquery/v1/query',
      {
        BusinessShortCode: env.MPESA_SHORTCODE,
        Password: Buffer.from(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${ts}`).toString('base64'),
        Timestamp: ts,
        CheckoutRequestID: checkoutRequestId,
      },
      'stk_query',
      relatedId,
    );
    return { done: true, resultCode: Number(body.ResultCode), resultDesc: body.ResultDesc };
  } catch (err) {
    // "The transaction is being processed" comes back as an error: not final yet.
    if (err.details?.errorCode === '500.001.1001') return { done: false };
    throw err;
  }
}

/** Pay a seller's Till or Paybill. Returns { ConversationID, OriginatorConversationID }; the outcome arrives later. */
export async function b2bPayment({ destinationType, destination, accountReference, amount, remarks, relatedId }) {
  if (isSimulated()) {
    const res = { ConversationID: fakeId('sim_AG'), OriginatorConversationID: fakeId('sim_oc'), ResponseCode: '0', simulated: true };
    await logMpesa('b2b', 'out', { simulated: true, destinationType, destination, amount }, relatedId);
    const t = setTimeout(() => {
      simulatedB2BResult?.({
        Result: {
          ResultType: 0,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully. (simulated)',
          OriginatorConversationID: res.OriginatorConversationID,
          ConversationID: res.ConversationID,
          TransactionID: fakeId('SIM').slice(0, 14).toUpperCase(),
        },
      });
    }, 1500);
    t.unref?.();
    return res;
  }
  const till = destinationType === 'till';
  return post(
    '/mpesa/b2b/v1/paymentrequest',
    {
      Initiator: env.MPESA_INITIATOR_NAME,
      SecurityCredential: env.MPESA_SECURITY_CREDENTIAL,
      CommandID: till ? 'BusinessBuyGoods' : 'BusinessPayBill',
      SenderIdentifierType: '4',
      RecieverIdentifierType: '4',
      Amount: amount,
      PartyA: env.MPESA_B2B_SHORTCODE || env.MPESA_SHORTCODE,
      PartyB: destination,
      AccountReference: accountReference.slice(0, 13),
      Remarks: (remarks || 'Meet2buy payout').slice(0, 100),
      QueueTimeOutURL: callbackUrl('b2b/timeout'),
      ResultURL: callbackUrl('b2b/result'),
    },
    'b2b',
    relatedId,
  );
}

/** Ask Safaricom what really happened to a payout (after a queue timeout). The answer arrives at status/result. */
export async function transactionStatus({ originatorConversationId, transactionId, relatedId }) {
  if (isSimulated()) return { simulated: true };
  return post(
    '/mpesa/transactionstatus/v1/query',
    {
      Initiator: env.MPESA_INITIATOR_NAME,
      SecurityCredential: env.MPESA_SECURITY_CREDENTIAL,
      CommandID: 'TransactionStatusQuery',
      ...(transactionId ? { TransactionID: transactionId } : { OriginalConversationID: originatorConversationId }),
      PartyA: env.MPESA_B2B_SHORTCODE || env.MPESA_SHORTCODE,
      IdentifierType: '4',
      ResultURL: callbackUrl('status/result'),
      QueueTimeOutURL: callbackUrl('status/timeout'),
      Remarks: 'Payout status check',
      Occasion: String(relatedId ?? ''),
    },
    'status',
    relatedId,
  );
}

/** Thrown to the buyer when payments can't start at all. */
export const paymentsOff = () =>
  new AppError(503, 'M-Pesa payments are not switched on yet. Please try again later.');
