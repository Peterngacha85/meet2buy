# 04 — Architecture

## 1. Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite), Tailwind CSS, React Router, Zustand (state), Axios |
| Backend | Node.js, Express — **MVC** (models, controllers, routes) + services layer |
| Database | MongoDB Atlas + Mongoose |
| Realtime (chat, presence, queue, pins, offers, payment status) | Socket.io |
| Live video & audio | **LiveKit** (LiveKit Cloud; `livekit-server-sdk` on backend, `@livekit/components-react` on frontend) |
| Images | Cloudinary |
| Payments | Safaricom **M-Pesa Daraja**: STK Push (buyer → Meet2buy) and B2B (Meet2buy → seller Till/Paybill) |
| Auth | JWT in httpOnly cookie, bcrypt password hashing |
| Hosting | Render (API + Socket.io, always-on paid instance), frontend on Vercel |

## 2. High-level diagram

```
        ┌────────────────────┐
        │  React web app      │
        │  (buyer/seller/     │
        │   admin)            │
        └──┬──────┬──────┬───┘
   REST    │      │ WS   │ WebRTC (video/audio)
           ▼      ▼      ▼
  ┌──────────────────┐  ┌────────────────┐
  │ Express API +    │  │ LiveKit Cloud  │
  │ Socket.io server │──│ (tokens issued │
  └──┬────┬─────┬────┘  │  by our API)   │
     │    │     │       └────────────────┘
     ▼    ▼     ▼
 MongoDB Cloudinary  M-Pesa Daraja
  Atlas              (STK push, B2B, callbacks → our API)
```

- The API **issues LiveKit access tokens**; video traffic goes directly between browsers and LiveKit, never through our server.
- Daraja sends payment and payout results to our **public callback URLs**.

## 3. Backend folder structure (MVC)

```
server/
├── src/
│   ├── config/          # db.js, cloudinary.js, livekit.js, mpesa.js, env.js
│   ├── models/          # User, Store, Product, RoomSession, ChatMessage,
│   │                    # QueueEntry, Offer, Order, Payment, Payout,
│   │                    # Setting, MpesaLog, PresentationRequest
│   ├── controllers/     # authController, storeController, productController,
│   │                    # roomController, orderController, paymentController,
│   │                    # adminController, uploadController
│   ├── routes/          # one file per controller, mounted under /api
│   ├── services/        # livekitService, mpesaService (token, stkPush, b2b),
│   │                    # commissionService, payoutService, cloudinaryService
│   ├── sockets/         # index.js (auth + rooms), roomHandlers.js,
│   │                    # queueHandlers.js, offerHandlers.js
│   ├── middleware/      # auth (protect), roles (allow('seller')), validate,
│   │                    # errorHandler, rateLimit
│   ├── validators/      # request schemas (zod or joi)
│   ├── utils/           # phone formatting (2547XXXXXXXX), maskContacts, logger
│   └── app.js
├── server.js            # http server + Socket.io bootstrap
└── .env
```

**Rule:** controllers stay thin — business logic (commission, payouts, M-Pesa calls) lives in `services/`.

## 4. Frontend folder structure (component-based)

```
client/src/
├── app/                 # router, providers, layouts (PublicLayout,
│                        # SellerLayout, AdminLayout)
├── pages/
│   ├── mall/            # MallHome, Wing, StorePage
│   ├── room/            # RoomPage (buyer), LiveControlPage (seller)
│   ├── buyer/           # MyOrders
│   ├── seller/          # Overview, StoreProfile, Products, Orders, Payouts
│   ├── admin/           # Overview, Sellers, Transactions, Payouts, LiveRooms, Users, Settings
│   └── auth/            # Login, Register, OpenStore
├── features/
│   ├── room/            # VideoStage, CounterTile, ProductShelf, PinnedProduct,
│   │                    # ChatPanel, QueuePanel, PresenceBar, OfferCard, JustBoughtToast
│   ├── checkout/        # CheckoutSheet, PaymentStatus
│   ├── mall/            # StorefrontCard, LiveStrip, WingNav
│   └── products/        # ProductCard, ProductForm, ProductModal
├── components/ui/       # Button, Badge, Card, Modal, Input, Tabs, StatusPill, Avatar
├── hooks/               # useAuth, useSocket, useRoom, useQueue
├── services/            # api.js (axios), socket.js
├── store/               # zustand stores (auth, room)
└── styles/
```

## 5. Environment variables

```
# App
NODE_ENV=
PORT=
CLIENT_URL=
API_PUBLIC_URL=            # public https URL (used for M-Pesa callbacks)
JWT_SECRET=

# Database
MONGO_URI=

# LiveKit
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# M-Pesa Daraja
MPESA_ENV=sandbox          # sandbox | production
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=           # Meet2buy Paybill
MPESA_PASSKEY=             # for STK push
MPESA_INITIATOR_NAME=      # for B2B
MPESA_SECURITY_CREDENTIAL= # encrypted initiator password
```

During development these point to **Fastweb's** accounts (and Daraja sandbox). For production, replace with the **client's** accounts.

## 6. Security essentials

- Passwords hashed (bcrypt), JWT in httpOnly + secure cookie.
- Role middleware on every seller/admin route; sellers can only edit **their own** store/products/orders.
- Socket.io connections authenticated with the same JWT; room actions (pin, call next, send offer) allowed only for the store owner.
- LiveKit tokens: buyers get **subscribe-only**; publish permission is granted only to the seller and to the buyer currently at the counter.
- M-Pesa callbacks: accept only expected fields, log raw payloads, and never trust the amount from the browser — always use the amount stored on the order.
- Rate-limit auth, chat and checkout endpoints.
- Validate and sanitise all input; mask phone numbers/links in public chat.
- Secrets only in env vars, never in the frontend.

## 7. Hosting & deployment

| Piece | Where |
|-------|-------|
| API + Socket.io | Render web service (paid, always on — free tier sleeps and would break live rooms) |
| Frontend | Vercel |
| Database | MongoDB Atlas (Flex tier for launch) |
| Video | LiveKit Cloud (Build plan in dev, Ship plan at launch) |
| Images | Cloudinary free tier |
| Domain & SSL | Client's domain, free SSL from host: `meet2buy.co.ke` → Vercel, `api.meet2buy.co.ke` → Render. Same domain is required for login cookies to work in Safari/iPhone. |

**Callbacks in development:** Daraja needs a public HTTPS URL → use ngrok (or a deployed dev API) for `API_PUBLIC_URL`.
