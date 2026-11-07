# 01 — Project Overview

## 1. The idea

A virtual shopping mall. Instead of scrolling a catalogue, a buyer walks through the mall, enters a seller's store (a live video room), watches products being demonstrated, asks questions, and buys — all in one live conversation.

**The customer should feel like they have walked into a physical store.**

### The mall concept (client brief)

Think of a physical mall like TRM:

| Physical mall | Meet2buy |
|---------------|----------|
| The building with a big mall name over the entrance | The home page: a prominent **MEET2BUY** sign for the whole marketplace |
| Shops inside, each with its own sign | Each registered business has a **shop sign** with its own name, logo and colours |
| Wings / floors | **Wings**, e.g. *Phones & Tablets*, *Home Appliances* |
| Departments inside a big shop | **Departments** inside a shop, e.g. Hisense → TVs, Cookers, Washing machines, Fridges |
| Walking up to a salesperson | **"Ready to buy? Click for a demonstration by a salesperson"** → live room |

**Most important design principle: Meet2buy is the mall. The registered businesses are the shops.**

The entrance must not be crowded with product pictures or unnecessary graphics. It communicates three things only:
1. This is Meet2buy.
2. This is a shopping destination.
3. Inside are different businesses (shown by their logos) waiting to serve you.

Shopping path: **Mall entrance → wing → shop → department → product line-up → "Ready to buy?" → demonstration by a salesperson → pay.**

Examples from the client:
- **Samsung** sells both, so its shop has two departments, *Home Appliances* and *Phones & Tablets*, and its sign appears in **both** wings. Entering from a wing opens that wing's department.
- **Tecno, Infinix, Oppo, vivo, Honor, realme:** Phones & Tablets wing only.
- **Hisense, LG, Hotpoint, TCL, Synix, Vision Plus:** Home Appliances wing, with departments TVs, Cookers, Washing machines and Fridges, each with its own line-up and demo button.

## 2. Business model

- Sellers **register for free** — no subscription fee.
- Meet2buy earns a **commission on every transaction**.
- The commission percentage is **set by the admin in the dashboard** (as agreed with each seller).
- Payment flow (see doc 08):
  1. Buyer pays via M-Pesa (STK push) into **Meet2buy's Paybill**.
  2. The system cuts the commission automatically.
  3. The system immediately sends the balance to the **seller's Till or Paybill** (M-Pesa B2B).
- Money is **not held** — payout is triggered as soon as payment is confirmed.
- **Sellers handle their own delivery.** After payment, the seller receives the buyer's delivery details.

## 3. User roles

| Role | Who | Main goal |
|------|-----|-----------|
| **Buyer** | Shoppers | Browse the mall, enter rooms, ask, buy |
| **Seller** | Brands / shop owners | Present products live and close sales |
| **Admin** | Meet2buy owner (client) | Approve sellers, set commission, monitor transactions and payouts |

Guests (not logged in) can walk the mall and watch rooms. Logging in is required to chat, join the queue, or buy.

## 4. MVP scope

### ✅ In scope (MVP)

**Seller**
- Register (free) and wait for admin approval
- Shop profile: name, logo (shop sign), sign colour, banner, description, departments (each in a wing), opening hours
- Payout details: Till number or Paybill + account number
- Product lineup: add / edit / hide products with photos, price, stock
- Start a room (go live) and end it
- Pin a product during the presentation
- See the queue and call the next buyer to the "counter"
- Answer questions in chat
- Send a buyer a price offer (close the sale)
- Orders list with buyer delivery details

**Buyer**
- Register / log in
- Mall tour: browse shop signs by wing, see who is LIVE NOW
- Shop page: departments, each with its product line-up
- "Ready to buy?" → demonstration by a salesperson (joins the queue if live, or leaves a demo request if closed)
- Enter a room: watch the seller, see other shoppers, chat
- Step up to the counter (audio/video with the seller) when called
- Buy at listed price or accept a seller's offer
- Pay with M-Pesa STK push
- My orders

**Admin**
- Approve / suspend sellers
- Set default commission % and per-seller commission %
- View all transactions, commissions earned and seller payouts
- Retry a failed payout
- Basic platform stats (sellers, live rooms, sales, commission)

### ❌ Out of scope (MVP) — future phases
- Mobile apps (React Native seller and buyer apps)
- Private 1-to-1 rooms separate from the main room
- Automatic recording / restreaming to YouTube
- SMS / WhatsApp notifications and scheduled shows
- Buyer protection / escrow / dispute centre
- Ratings and reviews
- Delivery integration (sellers handle delivery)
- Card payments
- Advanced analytics

## 5. Agreements with the client

| Item | Agreement |
|------|-----------|
| Budget | KES 80,000 for the MVP |
| Third-party services | Client subscribes and pays for all production accounts (LiveKit, MongoDB Atlas, Render, Cloudinary, Safaricom Daraja, domain) |
| Development accounts | Fastweb uses its own accounts during development, then switches to the client's for production |
| M-Pesa | Client applies to Safaricom for a Paybill with Daraja STK Push (C2B) and B2B access |
| Delivery | Sellers handle delivery |
| Changes | Anything outside the in-scope list above is quoted separately |

## 6. Success criteria for the MVP

1. A seller can register, be approved, list products and go live.
2. A buyer can find that store in the mall, enter the room, see and hear the seller, and chat.
3. A buyer can join the queue, be called to the counter and talk to the seller.
4. A buyer can buy, pay with M-Pesa, and the seller receives (payment − commission) automatically.
5. The admin can see the sale, the commission and the payout status.
