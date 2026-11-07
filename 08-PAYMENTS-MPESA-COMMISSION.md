# 08 — Payments, Commission & Seller Payouts (M-Pesa Daraja)

## 1. The agreed model

- Sellers join for **free**.
- Meet2buy earns a **commission on every sale**, set by the admin.
- Buyer pays **Meet2buy**; the system **cuts the commission** and **immediately pays the seller** the balance.
- No money is held for later — the payout is triggered as soon as Safaricom confirms the buyer's payment.

> **Note:** the money passes through Meet2buy's Paybill for a short moment (seconds to minutes) before the payout. That is how the split works with M-Pesa. Terms & conditions should state that Meet2buy collects payment on behalf of sellers and remits it immediately less commission. The client may wish to confirm with a lawyer whether any registration is needed for collecting on behalf of others.

## 2. The two Daraja APIs we use

| Step | Daraja API | Direction |
|------|-----------|-----------|
| Buyer pays | **M-Pesa Express (STK Push)** — Lipa Na M-Pesa Online, a C2B payment | Buyer → Meet2buy Paybill |
| Seller is paid | **B2B** — `BusinessBuyGoods` (to a Till) or `BusinessPayBill` (to a Paybill + account number) | Meet2buy Paybill → Seller's Till/Paybill |

Why STK push instead of buyers typing the Paybill manually: the buyer only enters their PIN, the amount and account are filled automatically, and we get an exact match to the order — no reconciliation guesswork.

## 3. Full payment flow

```
Buyer taps Pay
   │
   ▼
POST /api/orders/checkout
   ├─ validate product/offer, seller approved, payout details verified
   ├─ reserve stock: Product.updateOne({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })
   │     → 0 modified = out of stock → 409, stop
   ├─ if offer: Offer.updateOne({ _id, status: 'pending', expiresAt > now }, { status: 'in_checkout' })
   │     → 0 modified = offer gone → release stock, 409, stop
   ├─ create Order (awaiting_payment) with amount from DB (never from browser)
   ├─ create Payment (pending)
   └─ send STK push → save MerchantRequestID & CheckoutRequestID
   │
   ▼
Buyer enters M-Pesa PIN on phone
   │
   ▼
Safaricom → POST /api/mpesa/stk/callback
   ├─ log raw payload (mpesaLogs)
   ├─ find Payment by CheckoutRequestID (ignore if already final → idempotent)
   ├─ ResultCode ≠ 0 → payment failed/cancelled → order payment_failed
   │                     → release stock, unlock offer (back to pending/expired)
   │                     → socket payment:status (failed) to buyer
   └─ ResultCode = 0 →
        ├─ save MpesaReceiptNumber, paidAmount, paidAt
        ├─ paidAmount ≠ order amount → payment amount_mismatch, order on_hold
        │     (holdReason), NO payout, flag in admin Transactions → stop
        ├─ order → paid (stock already reserved); offer → paid
        ├─ commissionService: snapshot rate, compute commission & payout
        ├─ create Payout (pending)  ← unique per order
        ├─ socket payment:status (success) to buyer; sale:celebration to room
        └─ payoutService.send(payout)  → B2B request
              │
              ▼
Safaricom → POST /api/mpesa/b2b/result
   ├─ log raw payload
   ├─ find Payout by ConversationID
   ├─ ResultCode = 0 → completed (save TransactionID)
   └─ else → failed (save ResultDesc) → visible in admin Payouts → Retry

Safaricom → POST /api/mpesa/b2b/timeout   (request sat in Safaricom's queue too long)
   ├─ log raw payload
   ├─ payout stays processing — do NOT mark failed yet
   └─ run Transaction Status query → completed or failed based on the real outcome
```

## 4. Commission calculation

```
rate          = store.commissionRate ?? settings.defaultCommissionRate   (e.g. 8%)
commission    = round(amount × rate / 100)                               (whole KES)
payoutAmount  = amount − commission − (payoutFee if deductPayoutFeeFromSeller)
```

**Example:** buyer pays KES 2,500, rate 8% → commission KES 200 → seller receives KES 2,300.

Rules:
- The rate is **snapshotted** on the order at payment time.
- Admin can set a **default rate** and a **per-seller override** in the dashboard.
- All amounts are whole shillings.
- Safaricom charges a fee on B2B transfers. **Who pays it is a client decision** (see open questions):
  - Option A: Meet2buy absorbs it (fee comes out of the commission) — simpler for sellers.
  - Option B: deducted from the seller's payout — toggle `deductPayoutFeeFromSeller` in settings.

## 5. STK push details

- Endpoint (production): `https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest` (sandbox: `sandbox.safaricom.co.ke`).
- Auth: OAuth token from consumer key/secret (cache it — valid ~1 hour).
- `Password` = base64(Shortcode + Passkey + Timestamp `YYYYMMDDHHmmss`).
- `TransactionType`: `CustomerPayBillOnline`.
- `AccountReference`: the order number (e.g. `M2B-24A7K9`) — max 12 characters.
- `TransactionDesc`: short, e.g. "Meet2buy order".
- `PhoneNumber` / `PartyA`: buyer phone in `2547XXXXXXXX` format.
- `CallBackURL`: `API_PUBLIC_URL/api/mpesa/stk/callback`.

**Timeouts:** if no callback within ~2 minutes, call the **STK Push Query** API with the CheckoutRequestID to get the final status. Buyer sees "Didn't get the prompt? Try again".

**Unpaid-order sweeper:** a job runs every minute. For orders still `awaiting_payment` after 5 minutes it runs the STK query once more; if the result is still not success, the order → `cancelled`, payment → `timeout`, stock released (guarded by `stockReleased`), offer unlocked. A late success callback for a cancelled order is logged and flagged for admin (refund or manual fulfilment) — it never triggers an automatic payout.

## 6. B2B payout details

- Endpoint: `/mpesa/b2b/v1/paymentrequest`.
- `Initiator` + `SecurityCredential` (initiator password encrypted with Safaricom's public certificate).
- `CommandID`:
  - `BusinessBuyGoods` → seller has a **Till** (`PartyB` = till number)
  - `BusinessPayBill` → seller has a **Paybill** (`PartyB` = paybill, `AccountReference` = seller's account number)
- `SenderIdentifierType` / `RecieverIdentifierType`: `4` for shortcodes (confirm per current Daraja docs).
- `Amount`: payoutAmount.
- `PartyA`: Meet2buy shortcode.
- `Remarks`: order number.
- `QueueTimeOutURL` and `ResultURL`: our `/api/mpesa/b2b/timeout` and `/api/mpesa/b2b/result`.

The B2B request response only means "accepted for processing"; the real outcome comes in the **result callback**.

## 7. Safety rules (very important — this is real money)

1. **Idempotency:** a payout is created with a **unique index on `order`**. If a callback arrives twice, the second attempt to create a payout fails safely.
2. Never send a payout unless the payment status is `success` and the receipt number is saved.
3. Payout status moves forward only: `pending → processing → completed/failed`. Retries only allowed from `failed`.
4. Before a **retry**, check the previous attempt didn't actually succeed (Transaction Status query) to avoid paying twice.
5. Log every Daraja request and callback raw in `mpesaLogs`.
6. Amount always comes from the order in the database.
7. Callback endpoints respond fast with 200, then process.
8. Admin sees every failed payout with Safaricom's reason and can retry.
9. Seller payout details changes require admin re-verification before the next payout.

## 8. What the client must get from Safaricom

| Item | Why |
|------|-----|
| A **Paybill** in Meet2buy's (client's company) name | Receives buyer payments |
| Daraja production app with **M-Pesa Express (STK Push)** | Collect from buyers |
| **B2B API** access on the same shortcode | Pay sellers' Tills and Paybills |
| **Initiator** (API operator) username & password | Required for B2B |
| Confirmation of which account funds B2B payouts | So incoming funds are available for automatic payouts (avoid "insufficient funds" failures) |
| Passkey for STK push | Generated at go-live |

Business registration documents are needed for the go-live application. **Apply early** — approval can take time, and the payout feature cannot go to production without it. During development we use the **Daraja sandbox**.

## 9. Refunds and disputes (MVP)

Because sellers are paid immediately, Meet2buy does not hold funds for refunds. In the MVP:
- Returns/refunds are handled **directly between buyer and seller**.
- Terms & conditions must say this clearly.
- Admin can suspend sellers with repeated complaints.
- A proper buyer-protection/escrow flow can be added in a later phase.

## 10. Testing checklist (sandbox)
- [ ] STK push success → order paid → payout created → B2B success
- [ ] Buyer cancels STK prompt → order payment_failed, no payout
- [ ] Wrong PIN / insufficient balance → payment failed
- [ ] Callback received twice → only one payout
- [ ] No callback → STK query resolves status
- [ ] B2B fails → payout failed → admin retry succeeds
- [ ] Commission override for one seller applied correctly
- [ ] Rate changed after order → old orders unchanged
- [ ] Till payout and Paybill payout both work
- [ ] Two buyers check out the last unit → second gets "out of stock", no STK push
- [ ] Failed/cancelled payment → stock released exactly once
- [ ] Paid amount ≠ order amount → order on_hold, no payout
- [ ] Order unpaid after 5 min → cancelled, stock released
- [ ] Offer reaches expiresAt during STK prompt → payment still completes
- [ ] B2B timeout callback → status query, no blind failure or retry
