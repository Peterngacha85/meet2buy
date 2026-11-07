# 07 — The Live Room: Video, Realtime & Queue

The room combines two realtime channels:

| Channel | Tool | Carries |
|---------|------|---------|
| Video & audio | **LiveKit** (WebRTC) | Seller's camera/mic, counter buyer's mic/camera |
| Everything else | **Socket.io** | Chat, presence, viewer count, pinned product, queue, offers, payment status, "just bought" |

## 1. Why LiveKit
- WebRTC → under 1 second delay, so buyer and seller can actually converse (normal live streaming has a 5–30 s lag).
- One-to-many broadcast with the ability to give one buyer the "stage".
- Adapts video quality to weak mobile connections (simulcast).
- Open source — can move from LiveKit Cloud to a self-hosted server later to cut costs.
- React SDK now, React Native SDK for future mobile apps.

## 2. LiveKit room model

- **One LiveKit room per room session** — name: `store_<storeId>_<sessionId>`.
- Token permissions issued by our API:

| Participant | canPublish | canSubscribe | canPublishData |
|-------------|-----------|--------------|----------------|
| Seller | ✅ camera + mic | ✅ | ✅ |
| Buyer / guest (watching) | ❌ | ✅ | ❌ |
| Buyer at the counter | ✅ mic (+ camera optional) | ✅ | ❌ |

- When a buyer is called to the counter, the server uses the LiveKit server SDK to **update that participant's permissions** to allow publishing. When their turn ends, publishing is revoked and their tracks stop.
- Participant identity = user id (or `guest_<random>` for guests); participant name = display name.
- Video quality: seller publishes 720p with simulcast; viewers receive the layer their connection can handle.
- Room is closed with the server SDK when the seller ends the session or admin force-closes it.

## 3. Socket.io design

- Socket connections are authenticated with the JWT cookie (guests connect read-only).
- Each session is a Socket.io room: `session:<sessionId>`.
- The seller also joins `seller:<sessionId>` for seller-only events.
- Each user joins `user:<userId>` for private events (offers, payment status, "your turn").

### Events — client → server
| Event | Who | Payload | Action |
|-------|-----|---------|--------|
| `room:join` | anyone | `{ sessionId }` | Join, update presence, send room state |
| `room:leave` | anyone | `{ sessionId }` | Leave, update presence; leave queue if waiting |
| `chat:send` | buyer/seller | `{ sessionId, body }` | Mask phone numbers/links, save, broadcast |
| `product:pin` | seller | `{ sessionId, productId \| null }` | Set/clear pinned product |
| `queue:join` | buyer | `{ sessionId, productId?, note? }` | Add to queue if not already in it |
| `queue:leave` | buyer | `{ sessionId }` | Remove from queue |
| `queue:callNext` | seller | `{ sessionId }` | End current counter, call next waiting buyer |
| `queue:endCounter` | seller | `{ sessionId }` | End current counter session |
| `queue:skip` | seller | `{ sessionId, entryId }` | Skip a buyer |
| `offer:create` | seller | `{ sessionId, buyerId, productId, variant, quantity, price }` | Create offer, send to buyer |
| `offer:decline` | buyer | `{ offerId }` | Decline |

*(Accepting an offer = opening checkout with `offerId` → REST `/api/orders/checkout`.)*

### Events — server → client
| Event | To | Payload |
|-------|----|---------|
| `room:state` | joiner | `{ session, store, pinnedProduct, viewers, counterBuyer, recentMessages }` |
| `presence:update` | session | `{ viewerCount, shoppers: [{ id, name, avatar }] (first 20) }` |
| `chat:message` | session | message object |
| `product:pinned` | session | `{ product \| null }` |
| `queue:updated` | seller | full queue list |
| `queue:position` | user | `{ position, total }` |
| `counter:yourTurn` | user | `{ timeLimitMinutes }` — client then reconnects LiveKit with publish rights |
| `counter:changed` | session | `{ buyer \| null }` |
| `counter:ended` | user | — |
| `offer:received` | user | offer object |
| `offer:updated` | seller + user | `{ offerId, status }` |
| `payment:status` | user | `{ orderId, status, message }` |
| `sale:celebration` | session | `{ productName }` — "🎉 Someone just bought …" |
| `room:closed` | session | `{ reason }` |

## 4. Queue logic

1. Buyer taps **Ask to see this** (product attached) or **Join queue** → `queue:join`.
2. Server checks: buyer logged in, session live, buyer not already waiting/at counter → creates `queueEntry` (`waiting`).
3. Seller sees the list in order (oldest first) with each buyer's product of interest and note.
4. Each waiting buyer gets `queue:position` ("You're #3 of 5") whenever the queue changes.
5. Seller presses **Call next**:
   - Current counter buyer (if any) → `done`, publish rights revoked.
   - Next `waiting` entry → `at_counter`; session `counterBuyer` set.
   - Server grants LiveKit publish permission → emits `counter:yourTurn`.
   - If the entry has a product, it is **auto-pinned** so the room sees what is being shown.
6. Buyer's mic turns on (camera optional), seller and room hear them.
7. Counter time limit (default 5 min, admin setting) — at the limit the seller sees a "Time's up" prompt; the seller decides to end or continue (no forced cut-off in MVP).
8. Buyer leaving the room removes them from the queue (`left`). If they disconnect while at the counter, the counter is cleared.
9. Session end → all waiting entries become `cancelled` (so `done` always means "was served").

**Queue rules**
- One active entry per buyer per session.
- Seller can skip a buyer (`skipped`).
- Queue is stored in MongoDB (survives a server restart). Later, with multiple servers, move live state to Redis.

## 5. Presence & viewer count
- Tracked in memory per session (map of socketId → user), broadcast on change (throttled to once per second).
- `peakViewers` saved to the session.
- Guests count as viewers but show as "Guest" (not listed individually).

## 6. Chat rules
- Max 300 characters, rate-limited (e.g. 1 message per second per user).
- Phone numbers (`07…`, `01…`, `+254…`, `254…`) and URLs are replaced with `•••` in public chat.
- Seller messages are highlighted with a "Seller" badge.
- System messages: welcome, "X joined the queue", "Seller pinned …", "🎉 Someone just bought …".

## 7. The "physical store" feeling — checklist
- [ ] Video starts automatically on entry (muted autoplay fallback with "Tap to hear the seller").
- [ ] Welcome message with the buyer's name.
- [ ] Presence bar showing other shoppers.
- [ ] Product shelf always visible next to the video.
- [ ] Pinned product slides up when the seller holds something up.
- [ ] Queue position like waiting at a counter.
- [ ] "Someone just bought" moments create buzz.
- [ ] Closing a store shows a friendly "We're closed" screen with opening hours.

## 8. Edge cases
| Case | Handling |
|------|----------|
| Seller's internet drops | LiveKit reconnects; viewers see "Seller reconnecting…"; if the seller is gone > 2 min, end session automatically |
| Buyer on poor network | Lower video layer automatically; chat still works |
| Browser blocks camera/mic | Clear instructions to allow permissions; buyer can use chat only at the counter |
| Seller opens two tabs | Only one active seller connection; the newest takes over |
| Store suspended while live | Admin force-close → `room:closed` |
