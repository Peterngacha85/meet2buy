# 09 — Roadmap, Milestones & Open Questions

## 1. Build order (MVP, ~7 weeks)

| Sprint | Weeks | Deliverables |
|--------|-------|-------------|
| **1. Foundation** | 1 | Repo, MVC server, React + Tailwind with brand tokens, MongoDB, auth (buyer/seller/admin), deployment pipeline to Render, start Safaricom application (client) |
| **2. Sellers & products** ✅ | 2 | Seller registration wizard (account → shop + departments → payout), shop profile (logo, sign colour, banner, departments), payout details, product CRUD per department with Cloudinary direct uploads, admin seller approval |
| **3. The mall** | 3 | ✅ done early with Sprint 2: mall entrance (Meet2buy sign), wing directory of shop signs, search, shop page with departments + line-up + "Ready to buy?", demo (presentation) requests. Left: "Live now" strip with viewer counts (needs Sprint 4), opening hours |
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
- [~] Wing list for the mall: *Phones & Tablets* and *Home Appliances* confirmed from the client's examples; more wings to come
- [ ] Logos from the pilot businesses (each business uploads its own from the seller dashboard)
- [ ] Default commission %
- [ ] Terms & conditions and privacy policy text (or approval of a draft)
- [ ] 3–5 pilot sellers for testing before public launch

## 4. Open questions for the client

1. **Default commission %?** And will some sellers have different rates?
2. **Who pays the Safaricom B2B fee** — Meet2buy (from commission) or deducted from the seller's payout?
3. **Seller verification:** what documents should a seller provide (ID, KRA PIN, business registration) before approval?
4. **Minimum order amount?** (very small orders may be eaten up by fees)
5. **Refunds/returns policy** wording — confirmed that it's between buyer and seller in the MVP?
6. **Mall wings** — Phones & Tablets and Home Appliances so far. Which other wings (fashion, beauty, food…)?
10. **One salesperson per shop, or one per department?** The MVP has one live room per shop (the seller's account), so "click for a demonstration" in any department goes to that shop's room and queue. Separate salespeople per department, each live at the same time, is a future phase (quoted separately).
11. **Brand shops:** will the shops be the brands themselves (e.g. Samsung Kenya) or authorised dealers? Brand names and logos should only appear with the business's permission. The demo shops in `npm run seed:demo` are for presentations only and must be removed before launch.
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
| Department salespeople | Several staff accounts per shop, each running the live room for their own department at the same time |
