# 05 — Database Schema (MongoDB)

All collections have `createdAt` and `updatedAt` (Mongoose timestamps). Money is stored in **whole Kenyan shillings (integers)** — M-Pesa does not accept cents.

## users
| Field | Type | Notes |
|-------|------|-------|
| name | String | required |
| email | String | unique, lowercase |
| phone | String | format `2547XXXXXXXX` / `2541XXXXXXXX` |
| password | String | bcrypt hash, `select: false` |
| role | String | `buyer` \| `seller` \| `admin` |
| avatar | String | Cloudinary URL |
| status | String | `active` \| `suspended` \| `disabled` (retired, e.g. replaced .env admin; login says "Incorrect email or password") |
| isEnvOwner | Boolean | true for the admin managed by `ADMIN_EMAIL` in `.env`; protected from dashboard changes |

Phone is required for buyers and sellers, optional for admins.

## stores
| Field | Type | Notes |
|-------|------|-------|
| owner | ObjectId → users | one store per seller (MVP) |
| name | String | required (as on the shop sign) |
| slug | String | unique, for URLs; fixed once approved |
| description | String | |
| logo, banner | String | Cloudinary URLs (must be from our Cloudinary account) |
| brandColor | String | `#RRGGBB`, the shop sign colour |
| departments | [{ _id, name, slug, wing }] | 1–12; `wing` = wing slug from settings. Products point at the department `_id`, so renaming is safe |
| wings | [String] | derived from departments on save; indexed (a shop appears in every wing it has a department in) |
| statusChangedAt | Date | |
| openingHours | [{ day, open, close }] | display only in MVP |
| status | String | `pending` \| `approved` \| `rejected` \| `suspended` |
| rejectionReason | String | |
| payout | object | `select: false`; never sent to shoppers |
| payout.type | String | `till` \| `paybill` |
| payout.tillNumber | String | if till |
| payout.paybillNumber | String | if paybill |
| payout.accountNumber | String | if paybill |
| payout.registeredName | String | name on the Till/Paybill |
| payout.verified | Boolean | set by admin on approval |
| commissionRate | Number \| null | % override; `null` = use default |
| isLive | Boolean | quick flag for the mall |
| currentSession | ObjectId → roomSessions | |

## products
| Field | Type | Notes |
|-------|------|-------|
| store | ObjectId → stores | indexed |
| department | ObjectId | `_id` of one of the store's departments |
| name | String | |
| description | String | |
| price | Number | KES integer |
| images | [String] | max 5 |
| variants | [{ label, options: [String] }] | e.g. Size: S/M/L |
| stock | Number | |
| isVisible | Boolean | |

## roomSessions
| Field | Type | Notes |
|-------|------|-------|
| store | ObjectId → stores | |
| livekitRoom | String | unique LiveKit room name |
| status | String | `live` \| `ended` |
| startedAt, endedAt | Date | |
| pinnedProduct | ObjectId → products | |
| counterBuyer | ObjectId → users \| null | buyer currently at the counter |
| peakViewers | Number | |
| totalSales | Number | KES |

## chatMessages
| Field | Type | Notes |
|-------|------|-------|
| session | ObjectId → roomSessions | indexed |
| sender | ObjectId → users \| null | null for system messages |
| type | String | `text` \| `system` \| `offer` \| `purchase` |
| body | String | contacts masked before saving |
| offer | ObjectId → offers | when type = offer |

## queueEntries
| Field | Type | Notes |
|-------|------|-------|
| session | ObjectId → roomSessions | |
| buyer | ObjectId → users | unique per session while waiting |
| product | ObjectId → products \| null | "Ask to see this" |
| note | String | optional question |
| status | String | `waiting` \| `at_counter` \| `done` \| `left` \| `skipped` \| `cancelled` (session ended before they were served) |
| position | Number | computed from createdAt for display |
| calledAt, finishedAt | Date | |

## presentationRequests (store closed)
| Field | Type | Notes |
|-------|------|-------|
| store | ObjectId → stores | |
| buyer | ObjectId → users | |
| department | ObjectId \| null | department the request came from |
| product | ObjectId → products \| null | |
| message | String | max 300 |
| status | String | `open` \| `seen` \| `closed`; one open request per buyer + product (asking again updates it) |

## offers
| Field | Type | Notes |
|-------|------|-------|
| session | ObjectId → roomSessions | |
| store, seller, buyer | ObjectId | |
| product | ObjectId → products | |
| variant | String | |
| quantity | Number | |
| price | Number | total offer price KES |
| status | String | `pending` \| `in_checkout` \| `declined` \| `expired` \| `paid` |
| expiresAt | Date | default 10 minutes; ignored while `in_checkout` |
| order | ObjectId → orders \| null | set when checkout starts |

Offer transitions: `pending → in_checkout` (checkout started) → `paid`, or back to `pending` if payment fails (or `expired` if `expiresAt` has passed by then).

## orders
| Field | Type | Notes |
|-------|------|-------|
| orderNumber | String | unique, human readable e.g. `M2B-24A7K9` |
| buyer, store | ObjectId | |
| session | ObjectId \| null | room where it was bought |
| offer | ObjectId \| null | |
| items | [{ product, name, variant, quantity, unitPrice }] | snapshot |
| amount | Number | total KES charged |
| commissionRate | Number | % **snapshot at payment time** |
| commissionAmount | Number | KES |
| payoutAmount | Number | KES sent to seller |
| delivery | { name, phone, location, notes } | |
| status | String | `awaiting_payment` \| `paid` \| `payment_failed` \| `on_hold` \| `shipped` \| `delivered` \| `cancelled` |
| stockReleased | Boolean | true once reserved stock is returned (prevents double release) |
| holdReason | String | e.g. `amount_mismatch`, for admin review |
| payment | ObjectId → payments | |
| payout | ObjectId → payouts | |

## payments (buyer → Meet2buy, STK push)
| Field | Type | Notes |
|-------|------|-------|
| order | ObjectId → orders | |
| phone | String | |
| amount | Number | |
| merchantRequestId | String | from Daraja |
| checkoutRequestId | String | unique, from Daraja |
| status | String | `pending` \| `success` \| `failed` \| `cancelled` \| `timeout` \| `amount_mismatch` |
| paidAmount | Number | amount Safaricom reports in the callback |
| resultCode, resultDesc | | from callback |
| mpesaReceipt | String | unique, e.g. `SKA1B2C3D4` |
| paidAt | Date | |

## payouts (Meet2buy → seller, B2B)
| Field | Type | Notes |
|-------|------|-------|
| order | ObjectId → orders | **unique** (one payout per order) |
| store | ObjectId | |
| amount | Number | |
| destinationType | String | `till` \| `paybill` |
| destination | String | till or paybill number |
| accountReference | String | paybill account no. / order number |
| status | String | `pending` \| `processing` \| `completed` \| `failed` |
| conversationId, originatorConversationId | String | from Daraja |
| transactionId | String | M-Pesa receipt for the payout |
| resultCode, resultDesc | | |
| attempts | Number | |
| lastAttemptAt, completedAt | Date | |

## settings (single document)
| Field | Type | Notes |
|-------|------|-------|
| defaultCommissionRate | Number | % e.g. 8 |
| deductPayoutFeeFromSeller | Boolean | see doc 08 |
| offerExpiryMinutes | Number | default 10 |
| counterTimeLimitMinutes | Number | default 5 |
| wings | [{ name, slug, departments: [String] }] | mall wings + suggested department names. Default: Phones & Tablets, Home Appliances |

## mpesaLogs
Raw copy of every request sent to and callback received from Daraja: `{ type, direction, payload, relatedId }`. Never edited — used for reconciliation and support.

## Key indexes
- `stores`: `slug` unique, `owner` unique, `status + wings`, `isLive`
- `products`: `store + isVisible`, `store + department`
- `presentationRequests`: `store + status + createdAt`
- `queueEntries`: `session + status + createdAt`
- `payments`: `checkoutRequestId` unique, `mpesaReceipt` unique sparse
- `payouts`: `order` unique, `conversationId`
- `orders`: `orderNumber` unique, `store + createdAt`, `buyer + createdAt`, `status + createdAt` (for the unpaid-order sweeper)
