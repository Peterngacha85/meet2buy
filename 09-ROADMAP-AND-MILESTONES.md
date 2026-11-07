# 09 — Roadmap, Milestones & Open Questions

## 1. Build order (MVP, ~7 weeks)

| Sprint | Weeks | Deliverables |
|--------|-------|-------------|
| **1. Foundation** | 1 | Repo, MVC server, React + Tailwind with brand tokens, MongoDB, auth (buyer/seller/admin), deployment pipeline to Render, start Safaricom application (client) |
| **2. Sellers & products** | 2 | Seller registration wizard, store profile, payout details, product CRUD with Cloudinary, admin seller approval |
| **3. The mall** | 3 | Mall entrance, wings, storefront cards, store page, search, "Live now" strip, presentation requests |
| **4. The room (core)** | 4–5 | LiveKit integration, go live / end, buyer viewing, chat, presence, product shelf, pin product, room UI desktop + mobile |
| **5. Queue & counter** | 5 | Queue join/leave/position, call next, counter publish permissions, auto-pin |
| **6. Sales & payments** | 6 | Offers, checkout sheet, STK push + callback, commission, B2B payout + result handling, orders for buyer & seller |
| **7. Admin & launch** | 7 | Admin overview, transactions, payouts + retry, commission settings, live rooms, users; testing; switch to client's production accounts; go live |

**Protect the core:** if time runs short, the room (Sprint 4) and payments (Sprint 6) take priority over admin polish.

## 2. Payment milestones (KES 80,000)

| Milestone | Trigger | Amount |
|-----------|---------|--------|
| Deposit | Before work starts | KES 32,000 (40%) |
| Room demo | Seller can go live and buyers can watch, chat and queue (end of Sprint 5) | KES 24,000 (30%) |
| Launch | Payments & payouts working, deployed to production | KES 24,000 (30%) |

Running costs (hosting, video, database, Cloudinary, Safaricom charges, domain) are paid by the client directly on the client's accounts and are **not** part of the development fee.

## 3. Client checklist (things the client must provide)

- [x] Brand name (Meet2buy) and logo chosen
- [ ] Final logo files from the designer (SVG, icon-only, white version) and domain purchase
- [ ] Safaricom Paybill + Daraja go-live (STK Push + B2B) — **start in week 1**
- [ ] Accounts: LiveKit Cloud, MongoDB Atlas, Render, Cloudinary (add Fastweb as team member)
- [ ] Category (wing) list for the mall
- [ ] Default commission %
- [ ] Terms & conditions and privacy policy text (or approval of a draft)
- [ ] 3–5 pilot sellers for testing before public launch

## 4. Open questions for the client

1. **Default commission %?** And will some sellers have different rates?
2. **Who pays the Safaricom B2B fee** — Meet2buy (from commission) or deducted from the seller's payout?
3. **Seller verification:** what documents should a seller provide (ID, KRA PIN, business registration) before approval?
4. **Minimum order amount?** (very small orders may be eaten up by fees)
5. **Refunds/returns policy** wording — confirmed that it's between buyer and seller in the MVP?
6. **Mall categories (wings)** — final list?
7. ~~Can guests watch rooms without an account?~~ **Decided: yes** — guests can watch; login is required to chat, queue or buy (doc 01 §3).
8. **Expected launch traffic:** how many sellers live at the same time, and viewers per room? (affects LiveKit plan)
9. **Domain name** — e.g. `meet2buy.co.ke` / `meet2buy.com`?

## 5. Future phases (not in the KES 80,000 MVP)

| Feature | Notes |
|---------|-------|
| React Native apps (seller & buyer) | Sellers demo from phone camera more easily |
| Private 1-to-1 counter rooms | Separate LiveKit room for private conversations |
| Session recording / YouTube restream | LiveKit Egress → store's YouTube channel |
| SMS / WhatsApp notifications | Queue alerts, presentation requests, order updates |
| Scheduled live shows & reminders | "Store opens at 7 pm" with follow/notify |
| Ratings & reviews | Trust building |
| B2C payouts | For individual sellers without a Till/Paybill |
| Buyer protection / escrow | Hold funds until delivery is confirmed |
| Analytics | Foot traffic, conversion per session, top products |
| Visual mall map | Floors and wings as an illustrated, walkable map |
