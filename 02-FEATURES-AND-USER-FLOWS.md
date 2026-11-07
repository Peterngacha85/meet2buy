# 02 — Features & User Flows

## 1. Seller

### 1.1 Registration & approval
1. Seller clicks **Open your shop** → fills: full name, business email, phone, password.
2. Fills shop details: shop name (as on the sign), short description, and **departments**. Departments are picked wing by wing from suggestions (e.g. Home Appliances → TVs, Cookers, Washing Machines, Fridges) or typed in.
3. Fills payout details:
   - Payout type: **Till (Buy Goods)** or **Paybill**
   - Till number, or Paybill number + account number
   - Name registered on the Till/Paybill (for admin to verify)
4. Store status = `pending`. Seller sees "Your shop is under review" and a checklist: upload logo, set up departments, add products, payout verified.
5. While pending, the seller uploads the **logo** and picks a **sign colour** (shop profile) and can preview the shop.
6. Admin approves (this also verifies the payout number) → status `approved` → the shop sign appears in the mall. Admin can instead **reject with a reason**; the seller fixes it and clicks **Send for review again**.

> Rule: a store **cannot go live** until it is approved and has valid payout details.

### 1.2 Shop sign & departments
- **Shop sign:** logo on a board in the shop's own colour. Without a logo, the shop name is lettered on the board.
- **Departments:** 1–12 per shop, each in one mall wing. A shop appears in every wing it has a department in (Samsung: Phones & Tablets **and** Home Appliances).
- Departments can be renamed (products stay attached). A department that still has products cannot be removed.

### 1.3 Product line-up
- Add product: department, name, description, price (KES), up to 5 photos, stock quantity, optional variants (e.g. size/colour as simple text options).
- Edit, hide/show, delete.
- Products with stock 0 show "Out of stock" and cannot be bought.

### 1.4 Demo requests
- When the shop is closed, "Ready to buy?" saves a **demo request**: buyer name, product or department, optional question.
- The seller sees them under **Demo requests** (New / Seen / Done) and demonstrates those products at the next live session. Buyer contact details are not shown (rule 5).

### 1.5 Going live (start a room)
1. Seller opens **Go Live** → camera/mic preview → **Open store**.
2. Store shows **LIVE NOW** in the mall; a room session is created.
3. While live, the seller can:
   - **Pin a product** → product card pops up for every viewer with a **Buy** button
   - See **viewer count** and **who is in the room**
   - Read and reply in **chat**
   - See the **queue** and press **Call next**
   - **Send an offer** to a specific buyer (product, quantity, price)
   - **End counter session** for the current buyer
4. **Close store** ends the room; viewers see "This store has closed. Come back during opening hours."

### 1.6 Orders
- List of paid orders: product, qty, amount, commission, seller payout, payout status, buyer name, phone and delivery details.
- Seller marks order **Shipped** / **Delivered** (for record keeping).

---

## 2. Buyer

### 2.1 The mall tour (discovery)
- **Mall entrance (home):** the prominent **MEET2BUY** sign, one line saying what the place is ("The virtual shopping mall…"), counts (shops · wings · live now) and a **Walk in** button. **No product photos** on the entrance (doc 01 §1).
- **Live now** strip of shop signs, only when someone is live.
- **Mall directory:** shop signs grouped by **wing**, with wing tabs and a search box (shop or department name).
- **Wings:** start with *Phones & Tablets* and *Home Appliances* (client examples); the admin adds more (Sprint 7 settings).
- Each shop shows as a **shop sign**: logo on its brand colour, shop name, the departments it has in that wing, LIVE badge.

### 2.2 Shop page
- Breadcrumb Mall › Wing › Shop, then the large shop sign, name, description, live/closed status, optional banner.
- **Department tabs** (opens on the department of the wing you came from).
- Each department: **product line-up** grid → **"Ready to buy? Click for a demonstration by a salesperson"**.
- Tapping a product opens its details (photos, price, stock, variants) with the same **Get a live demonstration** button.
- If live (Sprint 4): the button takes the buyer into the room and the queue, with the product attached.
- If closed: the button saves a **demo request** for the seller (login required; no SMS in MVP).

### 2.3 Inside the room
1. Buyer enters → sees the seller's video immediately, a "Welcome to *Store Name*" message, and other shoppers in the presence bar.
2. Product shelf along the side/bottom → tap a product to view details.
3. **Ask to see this** on a product → joins the queue with that product attached.
4. Chat with the seller and other shoppers.
5. When called: "You're at the counter" → buyer turns on mic (camera optional) → talks to the seller, visible/heard by the room.
6. Buy:
   - **Buy now** on a pinned or shelf product (listed price), or
   - **Accept** an offer the seller sent (custom price).
7. Checkout sheet: quantity, M-Pesa phone number, delivery details (name, phone, location/address, notes) → **Pay**.
8. STK push prompt appears on the phone → buyer enters PIN.
9. On success: confirmation in the sheet, and the room sees "🎉 Someone just bought *Product*".

### 2.4 My orders
- List of orders with status, store name and seller contact phone (shown after payment for delivery coordination).

---

## 3. Admin

| Screen | Features |
|--------|----------|
| Overview | Total sellers, pending approvals, live rooms now, sales today/month, commission today/month |
| Sellers | Tabs: waiting for review / open / rejected / suspended. Shop sign preview, departments, product count, owner contact, payout info. Approve (+ verify payout), reject (with reason), suspend, reinstate, preview shop, set seller-specific commission % |
| Wings | Add / rename wings and their suggested departments (settings, Sprint 7) |
| Commission settings | Default commission %, toggle whether B2B transaction fees are deducted from seller payout (see doc 08) |
| Transactions | All orders: buyer, seller, amount, commission, payout amount, M-Pesa receipt, status; filter by date/store/status |
| Payouts | All payouts with status; **Retry** failed payouts; view Daraja result message |
| Live rooms | See which stores are live and viewer counts; **force-close** a room (moderation) |
| Users | List buyers, suspend abusive users |
| Admins | List admins, **add an admin** (promote an existing account or create one with a temporary password), remove admin access |

### Admin accounts
- **Owner admin** comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the server `.env` and is set up on every server start. Changing `ADMIN_PASSWORD` resets the password. Changing `ADMIN_EMAIL` **disables the previous owner**: its login shows "Incorrect email or password" and open sessions end.
- **Other admins** are added from the dashboard and have full admin powers.
- No admin can suspend, demote or remove the owner admin from the dashboard (prevents lock-out).

---

## 4. Key business rules

1. Commission % is **copied onto each order at the moment of payment** — changing the rate later never changes old orders.
2. Payout is triggered **only after Safaricom confirms payment** (callback with ResultCode 0).
3. One payment → one payout. Payouts must never be sent twice (see idempotency in doc 08).
4. Stock is **reserved at checkout** (atomic decrement, only if enough stock remains) and **released** if the payment fails, is cancelled or times out. This prevents two buyers paying for the last item.
5. Phone numbers and links are **masked in public chat** to discourage off-platform deals; the seller's phone is only shown to a buyer after they pay.
6. A buyer can only be in one queue position per room.
7. Suspended sellers' stores disappear from the mall immediately and their live room is closed.
8. Unpaid orders are cancelled automatically after 5 minutes if M-Pesa never confirms (see doc 08 §5).
9. Starting checkout on an offer **locks** it so it cannot expire mid-payment; it unlocks if the payment fails.
