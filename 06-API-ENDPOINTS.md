# 06 — API Endpoints

Base URL: `/api` · Auth: JWT cookie · 🔓 public · 👤 logged in · 🛍 seller · 🛡 admin

> **Route order:** in each router, register fixed paths (`/mine`, `/live`, `/wings`, `/checkout`, `/store`) **before** parameter paths (`/:slug`, `/:id`). Otherwise Express matches `/stores/mine` as a store with slug `mine`.

## Auth — `/api/auth`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/register` | 🔓 | Buyer registration. `acceptTerms: true` required (Terms & Privacy); `termsAcceptedAt` + `termsVersion` are stored |
| POST | `/register-seller` | 🔓 | Body `{ account: {name,email,phone,password}, store: {name, description, departments:[{name,wing}]}, payout }` → seller + pending shop. `acceptTerms: true` required. Field errors use paths like `account.email`, `payout.tillNumber` |
| POST | `/login` | 🔓 | Login, sets cookie |
| POST | `/google` | 🔓 | `{ credential }` = Google ID token. Verified against `GOOGLE_CLIENT_ID`; logs in, links an existing account with the same verified email, or creates a **buyer** — creating one needs `acceptTerms: true` (else 400, field `acceptTerms`). Refused for admin accounts (403) |
| GET | `/config` | 🔓 | `{ googleClientId }` (null when Google sign-in is off) |
| POST | `/logout` | 👤 | Clears cookie |
| GET | `/me` | 👤 | Current user (+ store if seller) |
| PATCH | `/me` | 👤 | Update name, phone, avatar, password |

## Mall & stores — `/api/stores`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/` | 🔓 | Approved shops (public fields only, never payout); query: `wing`, `live=true`, `q`, `page` |
| GET | `/live` | 🔓 | Stores live now with viewer counts (Sprint 4) |
| GET | `/wings` | 🔓 | Wings with suggested departments, shop and live counts, plus mall totals |
| GET | `/:slug` | 🔓 | Shop page + visible products. The owner and admins can preview a shop that is not approved yet (`preview: "pending"`) |
| GET | `/mine` | 🛍 | Seller's own shop (with payout) |
| PATCH | `/mine` | 🛍 | Update name, description, logo, banner, brandColor, departments (keep `id` to rename; 409 if removing a department that has products) |
| PATCH | `/mine/payout` | 🛍 | Update payout details (sets `payout.verified=false`) |
| POST | `/mine/resubmit` | 🛍 | Rejected → pending |
| POST | `/:storeId/presentation-requests` | 👤 | Demo request when closed: `{ product?, department?, message? }` |
| GET | `/mine/presentation-requests` | 🛍 | List requests |
| PATCH | `/mine/presentation-requests/:id` | 🛍 | Mark seen/closed |

## Products — `/api/products`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/:id` | 🔓 | Product details |
| GET | `/mine` | 🛍 | Seller's products |
| POST | `/` | 🛍 | Create product (`department` must be one of the seller's departments) |
| PATCH | `/:id` | 🛍 | Update (own only) |
| DELETE | `/:id` | 🛍 | Delete (own only) |

## Uploads — `/api/uploads`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/signature` | 👤 | `{ kind: logo\|banner\|product\|avatar\|support }` (buyers: `support` only, for after-sales photos) → `{ uploadUrl, apiKey, params, signature }`. The browser posts the file **directly to Cloudinary**; the API secret never leaves the server. Saved image URLs must start with `https://res.cloudinary.com/<our cloud>/image/upload/` |

## Rooms — `/api/rooms`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/start` | 🛍 | Start live session (store must be approved + payout set) → returns session + seller LiveKit token |
| POST | `/end` | 🛍 | End live session |
| GET | `/mine` | 🛍 | Seller's live control: current session + seller token (if live), shelf, presence |
| GET | `/:storeSlug` | 🔓 | Current session info (pinned product, status) |
| POST | `/:sessionId/token` | 🔓/👤 | LiveKit token: guests & buyers get subscribe-only |
| GET | `/:sessionId/messages` | 🔓 | Last 50 chat messages |
| GET | `/:sessionId/queue` | 👤 | Queue (buyer sees own position; seller sees full list) + who is at the counter |

*(Realtime actions — chat, pin, queue, offers — happen over Socket.io; see doc 07.)*

## Orders & checkout — `/api/orders`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/checkout` | 👤 | Body: `productId` + `quantity` + `variant` **or** `offerId`; `mpesaPhone`; `delivery`. Reserves stock, creates order (`awaiting_payment`), locks the offer if any, and sends STK push. Returns `orderId`. Fails with 409 if stock is insufficient or the offer is no longer `pending`. |
| GET | `/:id/status` | 👤 | Payment status (fallback polling if socket drops) |
| GET | `/:id/receipt` | 👤 | Receipt for a paid order: buyer copy (masked M-Pesa number), seller copy and admin copy (+ commission, payout). 404 for anyone else, 409 before payment |
| GET | `/mine` | 👤 | Buyer's orders |
| GET | `/store` | 🛍 | Seller's orders |
| PATCH | `/:id/fulfilment` | 🛍 | Mark shipped / delivered |
| POST | `/:id/simulate` | 👤 | Only with `MPESA_SIMULATE=true`: `{ action: pay \| cancel }` stands in for the PIN prompt |

Checkout with variations: `variant` is the choice `{ Storage: '256GB', Colour: 'Blue' }`; the matching variation's price is charged and its own stock reserved. Offers (`offer:create` socket event) take `skuId` for a product with variations.

Also: `GET /api/auth/badges` (👤) → sidebar counts `{ requests, orders, support }` for sellers, `{ pendingSellers, support }` for admins (support = after-sales requests waiting for them). Live updates arrive as the Socket.io `notify` event `{ type, title, body, link, action? }`.

## M-Pesa callbacks — `/api/pay` (called by Safaricom, no auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/stk/callback` | STK push result → mark payment, then trigger payout |
| POST | `/b2b/result` | B2B payout result |
| POST | `/b2b/timeout` | B2B queue timeout |

> Callbacks must always respond `200` quickly with `{ ResultCode: 0, ResultDesc: "Accepted" }`, then process.

## Admin — `/api/admin`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/stats` | 🛡 | Overview numbers |
| GET | `/sellers` | 🛡 | Filter `status`; includes owner contact, payout, product count, and counts per status |
| PATCH | `/sellers/:storeId/approve` | 🛡 | Approve + verify payout (also re-verifies changed payout details of an open shop) |
| PATCH | `/sellers/:storeId/reject` | 🛡 | Reject pending shop with `{ reason }` |
| PATCH | `/sellers/:storeId/suspend` | 🛡 | Suspend open shop, `{ reason? }` (closes live room) |
| PATCH | `/sellers/:storeId/reinstate` | 🛡 | Suspended → approved |
| PATCH | `/sellers/:storeId/commission` | 🛡 | Set override % or `null` |
| GET | `/settings` | 🛡 | Get settings |
| PATCH | `/settings` | 🛡 | `commissionTiers` (price bands `[{ name, min, max\|null, rate }]`, sorted, no overlaps, only the last open-ended), default commission (prices outside every band), fee toggle, wings, timers |
| GET | `/transactions` | 🛡 | Orders with payment & payout info; filters + date range; `q` matches order or receipt number |
| GET | `/payouts` | 🛡 | Payouts; filter by status |
| POST | `/payouts/:id/retry` | 🛡 | Retry a failed payout |
| GET | `/rooms/live` | 🛡 | Live rooms |
| POST | `/rooms/:sessionId/close` | 🛡 | Force-close a room |
| GET | `/users` | 🛡 | Users list |
| PATCH | `/users/:id/suspend` | 🛡 | Suspend / reactivate (refused for the owner admin) |
| GET | `/admins` | 🛡 | List admins (owner flagged) |
| POST | `/admins` | 🛡 | Add admin: `{ email, name?, phone? }` — promotes an existing account, or creates one and returns a temporary password |
| DELETE | `/admins/:id` | 🛡 | Remove admin access (account becomes `buyer`; refused for the owner admin and for yourself) |

## After-sales — `/api/support`
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/` | 👤 | Buyer opens a request on their paid order: `{ orderId, category, description, images? }`. One active request per order (409 with `errors[0].field = 'ticket'`, message = its id) |
| GET | `/mine` | 👤 | Buyer's requests (`?status=active\|resolved\|closed…`) |
| GET | `/store` | 🛍 | The shop's requests |
| GET | `/` | 🛡 | All requests (`?status=escalated` = waiting for Meet2buy) |
| GET | `/:id` | 👤 | One request (buyer, the shop, or admin) with `viewerRole` and allowed `actions` |
| POST | `/:id/messages` | 👤 | Reply `{ body, images? }`. Seller reply → `in_progress`; buyer reply on `resolved` → reopens |
| PATCH | `/:id/status` | 👤 | `{ status, note? }`. Buyer: escalate, close, reopen a resolved one. Seller: resolve. Admin: resolve, close, reopen |

## Response format
```
Success: { "success": true, "data": { ... } }
Error:   { "success": false, "message": "Readable message", "errors": [ ... ] }
```
