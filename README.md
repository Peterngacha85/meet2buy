# Meet2buy — Project Documentation

> **Meet2buy** — the virtual shopping mall.
> **Shop • Sell • Connect Globally**
> *Don't search for what you want, meet the person selling it.*

Meet2buy is a virtual marketplace where buyers and sellers meet face to face. Sellers present products live on video, buyers ask questions in real time, and purchasing happens during the conversation. Payment is made through M-Pesa, Meet2buy's commission is cut automatically, and the seller's share is sent straight to their Till or Paybill.

**Brand name:** Meet2buy · **Domain/handles:** lowercase `meet2buy` (domain TBD) · **Brand colours:** navy `#0B1F5C` + orange `#F7700A` on warm white
**Built by:** Fastweb Technologies · **Stack:** MERN + Socket.io + LiveKit + M-Pesa Daraja

---

## Documents

| # | File | What it covers |
|---|------|----------------|
| 01 | [01-PROJECT-OVERVIEW.md](01-PROJECT-OVERVIEW.md) | Vision, MVP scope (in / out), roles, agreements with the client |
| 02 | [02-FEATURES-AND-USER-FLOWS.md](02-FEATURES-AND-USER-FLOWS.md) | Seller, buyer and admin features, step-by-step flows |
| 03 | [03-BRAND-AND-UI.md](03-BRAND-AND-UI.md) | Logo, colours, typography, layout of every screen |
| 04 | [04-ARCHITECTURE.md](04-ARCHITECTURE.md) | Tech stack, MVC structure, folders, env variables, hosting |
| 05 | [05-DATABASE-SCHEMA.md](05-DATABASE-SCHEMA.md) | MongoDB collections and fields |
| 06 | [06-API-ENDPOINTS.md](06-API-ENDPOINTS.md) | REST endpoints by module |
| 07 | [07-LIVE-ROOM-VIDEO-AND-QUEUE.md](07-LIVE-ROOM-VIDEO-AND-QUEUE.md) | The virtual room: LiveKit video, Socket.io events, queue logic |
| 08 | [08-PAYMENTS-MPESA-COMMISSION.md](08-PAYMENTS-MPESA-COMMISSION.md) | STK push, commission cut, B2B payout to sellers |
| 09 | [09-ROADMAP-AND-MILESTONES.md](09-ROADMAP-AND-MILESTONES.md) | Build order, timeline, milestones, open questions |

## Running locally

Needs Node 20+ and a MongoDB (local `mongod`, or a free Atlas cluster).

```powershell
# API — http://localhost:5000
cd server
copy .env.example .env      # set JWT_SECRET (32+ chars) and MONGO_URI
npm install
npm run dev

# Web — http://localhost:5173 (proxies /api and /socket.io to :5000)
cd client
npm install
npm run dev
```

**Admin account:** set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters) in `server/.env`. On every start the server creates that account, or makes the existing account an admin. To change the admin password, edit `ADMIN_PASSWORD` and restart.

**Image uploads:** set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in `server/.env`. Check them with `npm run check:cloudinary` (uploads and deletes a 1-pixel test image).

**Demo shops:** `npm run seed:demo` adds the client's example shops (Samsung, Tecno, Hisense, LG…) with placeholder line-ups so the mall can be shown before real sellers join. `npm run seed:demo -- --remove` deletes them. It refuses to run with `NODE_ENV=production`. Remove the demo shops before launch.

Tests: `cd server; npm test` (uses an in-memory MongoDB — no setup needed).

### Deploying

**Backend → Render** (Web Service, paid instance so it never sleeps)
- Root directory: `server` · Build: `npm ci` · Start: `npm start` · Health check: `/api/health`
- Environment: everything in `server/.env.example`, with `NODE_ENV=production` and `CLIENT_URL` = the Vercel URL.

**Frontend → Vercel**
- Root directory: `client` · Framework: Vite (settings come from `client/vercel.json`)
- Environment: `VITE_API_URL` = the Render URL (e.g. `https://meet2buy-api.onrender.com`)

**Cookies across the two hosts:** while the sites are on `*.vercel.app` and `*.onrender.com` they are different sites, so set `COOKIE_SAME_SITE=none` on Render. Safari (all iPhones) blocks such cross-site cookies, so login will not stick there. Fix for launch: put both on the client's domain, e.g. `meet2buy.co.ke` → Vercel and `api.meet2buy.co.ke` → Render, then set `COOKIE_SAME_SITE=lax`.

## How to use these docs

1. Read **01** and **02** first — they define *what* we are building.
2. Build in the order set in **09**.
3. When building a module, keep its doc open in VS Code and give it to Claude as context together with **04** (architecture) and **05** (schema).
4. If anything changes with the client, update the relevant doc first, then the code.

## Golden rule

**The virtual room is the product.** Everything else (mall, profiles, admin) exists to get people into a room and to complete the sale that happens there. When time is short, protect the room and checkout first.
