# 03 — Brand & UI

## 1. Brand identity

| Item | Value |
|------|-------|
| Name | **Meet2buy** (capital M, lowercase b) |
| Domain / handles | lowercase `meet2buy` (domain TBD) |
| Logo tagline | **Shop • Sell • Connect Globally** |
| Hero headline (website) | *Don't search for what you want, meet the person selling it.* |
| Logo | Navy shopping bag with a white "M", orange orbit swoosh, "Meet2buy" wordmark in navy with an orange "2", orange arrow under the tagline |

> The tagline says "Globally", but the MVP takes payments through M-Pesa only (Kenya). Wider markets need card payments in a later phase.

## 2. Colour palette

Navy is the main brand and action colour, orange is the accent for money, live and success moments, and the background stays a soft warm white so the logo's navy and orange stand out.

| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#FFFBF5` | **Main page background** (soft warm white) |
| `--bg-soft` | `#F5F2EC` | Section backgrounds, sidebars, product shelf |
| `--white` | `#FFFFFF` | Cards, modals, chat panel |
| `--navy` | `#0B1F5C` | **Primary brand colour**: headings, primary buttons, navbar, links, active tabs |
| `--navy-dark` | `#071440` | Navy hover / pressed, footer |
| `--navy-soft` | `#E7EBF5` | Navy tinted backgrounds, selected states |
| `--orange` | `#F7700A` | **Accent**: LIVE badge, Buy now / Pay buttons, highlights, "just bought" toasts |
| `--orange-dark` | `#D85E00` | Orange hover / pressed |
| `--orange-ink` | `#B44A00` | Orange **text** on white/warm white (readable version of orange) |
| `--orange-soft` | `#FFF0E3` | Highlight and success-message backgrounds |
| `--ink` | `#14182B` | Body text |
| `--muted` | `#5B6175` | Secondary text |
| `--line` | `#E6E1D8` | Card borders and dividers |
| `--success` | `#1E8E3E` | Payment successful, approved, paid |
| `--danger` | `#D93025` | Errors, end-live, force-close |

The logo colours were sampled from the client's logo file. Ask the designer for the exact hex values and replace them if they differ slightly.

### Accessibility rules (important)
- **Navy `#0B1F5C` + white text** = excellent contrast ✅ → primary buttons.
- **Orange `#F7700A` + white text** = too low contrast for normal-size text ❌ → orange buttons use **navy text** (`#0B1F5C`), which reads well and matches the logo.
- For orange **text** on white/warm white, use `--orange-ink #B44A00`.
- Success states use green `--success` (not orange) so "paid" and "warning" never look the same.

### Colour roles at a glance
- **Navy** = brand, navigation and actions (Enter store, Join queue, Send, Save)
- **Orange** = energy and money (LIVE, Buy now, Pay, offers, "just bought")
- **Warm white** = the "mall floor"
- **Green / red** = system status only (success / error)

## 3. Typography

The wordmark is a heavy, rounded geometric sans, and the tagline is a light, wide-spaced sans.

| Use | Font | Weight |
|-----|------|--------|
| Headings | **Plus Jakarta Sans** (Google Fonts) | 700–800 |
| Body, UI | **Inter** (Google Fonts) | 400 / 500 / 600 |
| Small labels / taglines | Inter, letter-spacing 0.04em | 500 |

Sizes: H1 40/48 desktop (28 mobile), H2 28, H3 20, body 16, small 14, labels 12 uppercase with letter spacing.

## 4. Logo usage

**Files to request from the designer:**
- [ ] Full logo (bag + wordmark + tagline): SVG and PNG, transparent background
- [ ] Horizontal logo without tagline (for the navbar)
- [ ] Icon only (bag with "M" and orbit): for favicon, app icon, seller badge
- [ ] White / reversed version for navy backgrounds (footer, dark sections)
- [ ] Favicon sizes: 32px, 180px (Apple), 192px, 512px

**Where it goes:**
| Place | Version |
|-------|---------|
| Navbar | Horizontal logo without tagline, height ~36px |
| Mall entrance | White full logo with tagline, large, as the sign over the entrance |
| Footer | White version on navy |
| Browser tab / PWA | Icon only |
| Loading screen | Icon with gentle pulse |
| Auth pages | Full logo, centred |

**Rules:** keep clear space around the logo equal to the height of the "M" on the bag; don't stretch it, recolour it or put it on busy photos.

The orange arrow under the tagline can be reused as a subtle decorative element (section dividers, hero underline).

## 5. UI style

- Rounded corners: cards 16px, buttons 12px, badges full pill.
- Soft shadows only on floating elements (pinned product card, modals).
- Generous spacing; 8px spacing scale.
- Icons: Lucide (outline), navy by default.
- Motion: subtle. The pinned product slides up, the "just bought" toast pops in, and the LIVE badge gently pulses.
- Mobile-first: most Kenyan buyers will be on phones.

## 6. Screens

### Public / Buyer
| Screen | Key elements |
|--------|-------------|
| **Mall entrance (Home)** | Navy entrance band with the white full logo as a lit **MEET2BUY sign**, "Welcome to", one line ("The virtual shopping mall…"), counts (shops · wings · live now), **Walk in** button, orange canopy line. **No product photos or decorative graphics** (client rule, doc 01 §1). Below: "Live now" signs (only if any), **mall directory** of shop signs grouped by wing with wing tabs + search, small "Own a business? Open your shop" band |
| **Shop sign (component)** | Board in the shop's `brandColor` with its logo on a white plate (or the name lettered in white caps if no logo), LIVE pill, then name + departments in that wing |
| **Shop page** | Breadcrumb, large shop sign, name, description, Live/Closed, banner (optional), sticky **department tabs**, per department: product line-up grid + navy **"Ready to buy?"** panel with orange **Get a demonstration** button; product details dialog with the same button |
| **Room** | See layout below |
| **Checkout sheet** | Product summary, qty, M-Pesa number, delivery details, Pay button (orange, navy text), waiting-for-PIN state, success/failure state |
| **My orders** | Order cards with status |
| **Auth** | Login, register (buyer), Open a store (seller register wizard) |

### Room layout (the product)

**Desktop**
```
┌───────────────────────────────────────────────────────────────┐
│ ← Mall   [Logo] Store Name   ● LIVE  👁 23 shoppers   [Leave] │
├─────────────────────────────────────────┬─────────────────────┤
│                                         │  [Chat] [Queue (4)] │
│            SELLER VIDEO STAGE           │                     │
│     (counter guest appears as a         │  chat messages…     │
│      smaller tile when called)          │                     │
│                                         │                     │
│   ┌─────────── pinned product ───────┐  │                     │
│   │ img  Name   KES 2,500  [Buy now] │  │                     │
│   └──────────────────────────────────┘  │  [ type message… ]  │
├─────────────────────────────────────────┴─────────────────────┤
│ PRODUCT SHELF:  [img] [img] [img] [img] [img]  →               │
│ Shoppers here: (A)(K)(M)(J) +19                                │
└───────────────────────────────────────────────────────────────┘
```

**Mobile**
- Video full width at top (16:9), LIVE badge + viewers overlaid.
- Pinned product as a sticky bottom card with orange **Buy now**.
- Tabs below video: **Shelf · Chat · Queue**.
- Floating navy **Ask to see / Join queue** button.

### Seller dashboard
| Screen | Key elements |
|--------|-------------|
| Overview | Store status, today's sales, pending requests, **Go Live** button (orange) |
| Store profile | Edit details, logo, banner, hours |
| Products | Table/grid, add/edit modal |
| Live control (seller's room view) | Camera preview, mic/cam toggles, pin product list, queue with **Call next**, offer composer, chat, End live |
| Orders | Orders table with delivery details, status update |
| Payout settings | Till/Paybill details (changes require admin re-approval) |

### Admin dashboard
Navy sidebar with white text, active item highlighted with an orange left bar: Overview · Sellers · Transactions · Payouts · Live rooms · Users · Settings. Tables on white cards with status pills.

## 7. Status pill colours

| Status | Background | Text |
|--------|-----------|------|
| LIVE | `--orange` | navy, with pulsing dot |
| Pending | `#FFF4D6` | `#8A6100` |
| Approved / Paid / Completed | `#E6F4EA` | `--success` |
| Failed / Suspended | `#FDE8E7` | `--danger` |
| Processing | `--navy-soft` | `--navy` |

## 8. Tailwind tokens (for setup)

The project uses **Tailwind v4**, so tokens live in CSS, not `tailwind.config`: see `@theme` in [client/src/styles/index.css](client/src/styles/index.css). They give classes like `bg-navy`, `bg-navy-soft`, `bg-orange`, `text-orange-ink`, `border-line`, `text-muted`, `font-display`, `rounded-card`, `rounded-btn`. The body is set to `bg-bg text-ink`.

`--color-orange` adds `bg-orange` etc. *alongside* Tailwind's built-in `orange-50…950` scale — no clash. Always use the brand names (`orange`, `orange-dark`, `orange-ink`, `orange-soft`), not the numbered scale.
