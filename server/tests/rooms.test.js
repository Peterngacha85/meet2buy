import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { io as connect } from 'socket.io-client';

// Tokens are signed for real (no network); closing a LiveKit room would call LiveKit Cloud, so it is stubbed.
vi.mock('../src/services/livekit.js', async (importOriginal) => ({
  ...(await importOriginal()),
  closeLiveKitRoom: vi.fn(async () => {}),
  setCounterPublish: vi.fn(async () => true),
}));

const { createApp } = await import('../src/app.js');
const { initSockets } = await import('../src/sockets/index.js');
const { User } = await import('../src/models/User.js');
const { Store } = await import('../src/models/Store.js');
const { RoomSession } = await import('../src/models/RoomSession.js');
const { ChatMessage } = await import('../src/models/ChatMessage.js');
const { QueueEntry } = await import('../src/models/QueueEntry.js');
const { closeLiveKitRoom, setCounterPublish } = await import('../src/services/livekit.js');
const { maskContacts } = await import('../src/utils/maskContacts.js');

const app = createApp();
const server = http.createServer(app);
let baseUrl;
const sockets = [];

beforeAll(async () => {
  initSockets(server);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await new Promise((resolve) => server.close(resolve));
});

const cookieFrom = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('m2b_token='))?.split(';')[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openShop({ approve = true } = {}) {
  const res = await request(app)
    .post('/api/auth/register-seller')
    .send({
      account: { name: 'Grace Achieng', email: 'grace@hisense.test', phone: '0722 000 111', password: 'supersecret1' },
      store: { name: 'Hisense', departments: [{ name: 'TVs', wing: 'home-appliances' }] },
      payout: { type: 'till', tillNumber: '123 456', registeredName: 'HISENSE KENYA' },
    });
  const seller = cookieFrom(res);
  const store = res.body.data.store;
  let admin;
  if (approve) {
    admin = await loginAs('admin', 'boss@meet2buy.test');
    await request(app).patch(`/api/admin/sellers/${store.id}/approve`).set('Cookie', admin);
  }
  const product = await request(app)
    .post('/api/products')
    .set('Cookie', seller)
    .send({ name: 'Hisense 55" 4K TV', price: 54999, stock: 4, department: store.departments[0].id });
  return { seller, admin, store, product: product.body.data.product };
}

async function loginAs(role, email, name = `${role} user`) {
  await User.create({ name, email, phone: '254733000222', password: 'supersecret1', role });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'supersecret1' });
  return cookieFrom(res);
}

function socketAs(cookie) {
  const s = connect(baseUrl, {
    transports: ['websocket'],
    forceNew: true,
    extraHeaders: cookie ? { Cookie: cookie } : {},
  });
  sockets.push(s);
  return new Promise((resolve, reject) => {
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

const nextEvent = (s, event) => new Promise((resolve) => s.once(event, resolve));
const grants = (token) => jwt.decode(token).video;

describe('REST /api/rooms', () => {
  it('only lets an approved shop go live', async () => {
    const { seller } = await openShop({ approve: false });
    const res = await request(app).post('/api/rooms/start').set('Cookie', seller);
    expect(res.status).toBe(403);
  });

  it('starts one session per shop and gives the seller a publishing token', async () => {
    const { seller, store } = await openShop();

    const res = await request(app).post('/api/rooms/start').set('Cookie', seller);
    expect(res.status).toBe(201);
    const { session, livekit } = res.body.data;
    expect(session).toMatchObject({ store: store.id, status: 'live', pinnedProduct: null });
    expect(livekit.url).toBe('wss://test.livekit.cloud');
    expect(grants(livekit.token)).toMatchObject({ roomJoin: true, canPublish: true, canSubscribe: true });

    // Pressing "Go live" again (or reloading) returns the same session.
    const again = await request(app).post('/api/rooms/start').set('Cookie', seller);
    expect(again.body.data.session.id).toBe(session.id);
    expect(await RoomSession.countDocuments()).toBe(1);

    const saved = await Store.findById(store.id);
    expect(saved.isLive).toBe(true);
    expect(saved.currentSession.toString()).toBe(session.id);
  });

  it('shows shoppers the room and gives guests and buyers watch-only tokens', async () => {
    const { seller } = await openShop();
    const { session } = (await request(app).post('/api/rooms/start').set('Cookie', seller)).body.data;

    const room = await request(app).get('/api/rooms/hisense');
    expect(room.status).toBe(200);
    expect(room.body.data.session.id).toBe(session.id);
    expect(room.body.data.products).toHaveLength(1);
    expect(room.body.data.isOwner).toBe(false);

    const guest = await request(app).post(`/api/rooms/${session.id}/token`);
    expect(guest.body.data.role).toBe('viewer');
    expect(jwt.decode(guest.body.data.livekit.token).sub).toMatch(/^guest_/);
    expect(grants(guest.body.data.livekit.token)).toMatchObject({ canPublish: false, canSubscribe: true });

    const buyer = await loginAs('buyer', 'amina@example.com');
    const asBuyer = await request(app).post(`/api/rooms/${session.id}/token`).set('Cookie', buyer);
    expect(grants(asBuyer.body.data.livekit.token).canPublish).toBe(false);

    const asOwner = await request(app).post(`/api/rooms/${session.id}/token`).set('Cookie', seller);
    expect(asOwner.body.data.role).toBe('seller');
  });

  it('ends the session, closes the LiveKit room and refuses tokens afterwards', async () => {
    const { seller, store } = await openShop();
    const { session } = (await request(app).post('/api/rooms/start').set('Cookie', seller)).body.data;

    const res = await request(app).post('/api/rooms/end').set('Cookie', seller);
    expect(res.status).toBe(200);
    expect(closeLiveKitRoom).toHaveBeenCalledWith(`store_${store.id}_${session.id}`);
    expect((await Store.findById(store.id)).isLive).toBe(false);
    expect((await RoomSession.findById(session.id)).endReason).toBe('seller');

    expect((await request(app).post(`/api/rooms/${session.id}/token`)).status).toBe(404);
    expect((await request(app).post('/api/rooms/end').set('Cookie', seller)).status).toBe(409);
  });

  it('closes the room when an admin suspends the shop', async () => {
    const { seller, admin, store } = await openShop();
    const { session } = (await request(app).post('/api/rooms/start').set('Cookie', seller)).body.data;

    await request(app).patch(`/api/admin/sellers/${store.id}/suspend`).set('Cookie', admin).send({ reason: 'Fake goods' });
    const ended = await RoomSession.findById(session.id);
    expect(ended).toMatchObject({ status: 'ended', endReason: 'suspended' });
  });

  it('ends the session by itself when the seller never comes back', async () => {
    const { seller } = await openShop();
    const { session } = (await request(app).post('/api/rooms/start').set('Cookie', seller)).body.data;
    await sleep(1500); // SELLER_GRACE_SECONDS=1 in tests
    expect((await RoomSession.findById(session.id)).endReason).toBe('seller_gone');
  });
});

describe('Socket.io room', () => {
  it('runs presence, chat and pinning, then tells everyone when the room closes', async () => {
    const { seller, product } = await openShop();
    const { session } = (await request(app).post('/api/rooms/start').set('Cookie', seller)).body.data;
    const buyerCookie = await loginAs('buyer', 'amina@example.com', 'Amina Wanjiru');

    const sellerSocket = await socketAs(seller);
    const sellerJoin = await sellerSocket.emitWithAck('room:join', { sessionId: session.id });
    expect(sellerJoin).toMatchObject({ ok: true, isSeller: true });

    const buyer = await socketAs(buyerCookie);
    const presence = nextEvent(sellerSocket, 'presence:update');
    const buyerJoin = await buyer.emitWithAck('room:join', { sessionId: session.id });
    expect(buyerJoin).toMatchObject({ ok: true, isSeller: false, canChat: true });
    // The seller is not counted as a viewer.
    expect(await presence).toMatchObject({ viewerCount: 1, shoppers: [{ name: 'Amina Wanjiru' }], sellerHere: true });

    const guest = await socketAs(null);
    expect(await guest.emitWithAck('room:join', { sessionId: session.id })).toMatchObject({ ok: true, canChat: false });
    expect(await guest.emitWithAck('chat:send', { sessionId: session.id, body: 'hi' })).toMatchObject({ ok: false });

    // Chat: contacts are masked before anyone sees them.
    const seen = nextEvent(sellerSocket, 'chat:message');
    const sent = await buyer.emitWithAck('chat:send', { sessionId: session.id, body: 'Call me on 0712 345 678 please' });
    expect(sent.ok).toBe(true);
    const msg = await seen;
    expect(msg).toMatchObject({ type: 'text', body: 'Call me on ••• please', sender: { name: 'Amina Wanjiru', isSeller: false } });
    // One message per second.
    expect(await buyer.emitWithAck('chat:send', { sessionId: session.id, body: 'again' })).toMatchObject({ ok: false });

    // Only the seller can pin.
    expect(await buyer.emitWithAck('product:pin', { sessionId: session.id, productId: product.id })).toMatchObject({ ok: false });
    const pinned = nextEvent(buyer, 'product:pinned');
    expect(await sellerSocket.emitWithAck('product:pin', { sessionId: session.id, productId: product.id })).toMatchObject({ ok: true });
    expect((await pinned).product.name).toBe('Hisense 55" 4K TV');

    const history = await request(app).get(`/api/rooms/${session.id}/messages`);
    expect(history.body.data.messages.map((m) => m.type)).toEqual(['text', 'system']);

    // Viewer counts show in the mall directory.
    const list = await request(app).get('/api/stores');
    expect(list.body.data.stores[0]).toMatchObject({ isLive: true, viewers: 2 });

    const closed = nextEvent(buyer, 'room:closed');
    await request(app).post('/api/rooms/end').set('Cookie', seller);
    expect(await closed).toMatchObject({ reason: 'seller' });
    expect((await RoomSession.findById(session.id)).peakViewers).toBe(2);
    expect(await ChatMessage.countDocuments({ session: session.id })).toBe(2);
  });

  it('starts the "seller gone" clock when the seller disconnects, and stops it when they return', async () => {
    const { seller } = await openShop();
    const { session } = (await request(app).post('/api/rooms/start').set('Cookie', seller)).body.data;

    const first = await socketAs(seller);
    await first.emitWithAck('room:join', { sessionId: session.id });
    first.disconnect();
    await sleep(400);
    const back = await socketAs(seller);
    await back.emitWithAck('room:join', { sessionId: session.id });
    await sleep(1200);
    expect((await RoomSession.findById(session.id)).status).toBe('live');

    back.disconnect();
    await sleep(1500);
    expect((await RoomSession.findById(session.id)).endReason).toBe('seller_gone');
  });
});

describe('Queue & counter', () => {
  async function liveRoomWithBuyers() {
    const { seller, product } = await openShop();
    const { session } = (await request(app).post('/api/rooms/start').set('Cookie', seller)).body.data;
    const sellerSocket = await socketAs(seller);
    await sellerSocket.emitWithAck('room:join', { sessionId: session.id });
    const amina = await socketAs(await loginAs('buyer', 'amina@example.com', 'Amina Wanjiru'));
    await amina.emitWithAck('room:join', { sessionId: session.id });
    await User.create({ name: 'Brian Otieno', email: 'brian@example.com', phone: '254733000333', password: 'supersecret1', role: 'buyer' });
    const brianCookie = cookieFrom(await request(app).post('/api/auth/login').send({ email: 'brian@example.com', password: 'supersecret1' }));
    const brian = await socketAs(brianCookie);
    await brian.emitWithAck('room:join', { sessionId: session.id });
    return { seller, session, product, sellerSocket, amina, brian, brianCookie };
  }

  it('lines buyers up, calls them to the counter one by one and auto-pins what they asked to see', async () => {
    const { session, product, sellerSocket, amina, brian, brianCookie } = await liveRoomWithBuyers();
    const sid = session.id;

    // Amina asks to see the TV with a note; contacts in notes are masked too.
    const joined = await amina.emitWithAck('queue:join', { sessionId: sid, productId: product.id, note: 'Does it come with a wall mount? 0712345678' });
    expect(joined).toMatchObject({ ok: true, mine: { status: 'waiting', position: 1, total: 1 } });
    // Joining twice keeps one place.
    expect((await amina.emitWithAck('queue:join', { sessionId: sid })).mine.position).toBe(1);

    const brianPos = nextEvent(brian, 'queue:position');
    const sellerList = nextEvent(sellerSocket, 'queue:updated');
    await brian.emitWithAck('queue:join', { sessionId: sid });
    expect(await brianPos).toMatchObject({ status: 'waiting', position: 2, total: 2 });
    const list = await sellerList;
    expect(list.entries.map((e) => e.buyer.name)).toEqual(['Amina Wanjiru', 'Brian Otieno']);
    expect(list.entries[0]).toMatchObject({ note: 'Does it come with a wall mount? •••', product: { name: 'Hisense 55" 4K TV' } });

    // Buyers can't run the counter; the seller can't queue.
    expect(await amina.emitWithAck('queue:callNext', { sessionId: sid })).toMatchObject({ ok: false });
    expect(await sellerSocket.emitWithAck('queue:join', { sessionId: sid })).toMatchObject({ ok: false });

    // Call next → Amina is at the counter, gets publish rights, and the TV is pinned for the room.
    const yourTurn = nextEvent(amina, 'counter:yourTurn');
    const changed = nextEvent(brian, 'counter:changed');
    const pinned = nextEvent(brian, 'product:pinned');
    const brianMoves = nextEvent(brian, 'queue:position');
    const called = await sellerSocket.emitWithAck('queue:callNext', { sessionId: sid });
    expect(called.counter).toMatchObject({ buyer: { name: 'Amina Wanjiru' }, timeLimitMinutes: 5 });
    expect(await yourTurn).toMatchObject({ granted: true, timeLimitMinutes: 5 });
    expect((await changed).counter.buyer.name).toBe('Amina Wanjiru');
    expect((await pinned).product.id).toBe(product.id);
    expect(await brianMoves).toMatchObject({ position: 1, total: 1 });
    expect(setCounterPublish).toHaveBeenLastCalledWith(expect.stringContaining(sid), expect.any(String), true);

    // A buyer reconnecting while at the counter gets a counter token; others stay watch-only.
    const aminaUser = await User.findOne({ email: 'amina@example.com' });
    expect((await RoomSession.findById(sid)).counterBuyer.toString()).toBe(aminaUser.id);
    expect((await request(app).post(`/api/rooms/${sid}/token`).set('Cookie', brianCookie)).body.data.role).toBe('viewer');

    // Next: Amina is done (publishing revoked), Brian comes up.
    const aminaEnded = nextEvent(amina, 'counter:ended');
    const brianTurn = nextEvent(brian, 'counter:yourTurn');
    await sellerSocket.emitWithAck('queue:callNext', { sessionId: sid });
    expect(await aminaEnded).toMatchObject({ status: 'done' });
    await brianTurn;
    expect(setCounterPublish).toHaveBeenCalledWith(expect.any(String), aminaUser.id, false);

    // Brian's REST view of the queue.
    const q = await request(app).get(`/api/rooms/${sid}/queue`).set('Cookie', brianCookie);
    expect(q.body.data).toMatchObject({ mine: { status: 'at_counter' }, counter: { buyer: { name: 'Brian Otieno' } } });

    // End counter; nobody left → Call next just reports an empty counter.
    expect(await sellerSocket.emitWithAck('queue:endCounter', { sessionId: sid })).toMatchObject({ ok: true });
    expect(await sellerSocket.emitWithAck('queue:callNext', { sessionId: sid })).toMatchObject({ ok: true, counter: null });
    expect((await QueueEntry.find({ session: sid }).sort({ createdAt: 1 })).map((e) => e.status)).toEqual(['done', 'done']);
  });

  it('lets buyers leave, the seller skip, and cancels whoever is still waiting when the room closes', async () => {
    const { seller, session, sellerSocket, amina, brian } = await liveRoomWithBuyers();
    const sid = session.id;
    await amina.emitWithAck('queue:join', { sessionId: sid });
    await brian.emitWithAck('queue:join', { sessionId: sid });

    expect(await amina.emitWithAck('queue:leave', { sessionId: sid })).toMatchObject({ ok: true });
    const brianEntry = await QueueEntry.findOne({ session: sid, active: true });
    const skipped = nextEvent(brian, 'queue:position');
    await sellerSocket.emitWithAck('queue:skip', { sessionId: sid, entryId: brianEntry.id });
    expect(await skipped).toMatchObject({ status: 'skipped' });

    // Walking out of the room (explicit leave) drops your place straight away.
    await amina.emitWithAck('queue:join', { sessionId: sid });
    await amina.emitWithAck('room:leave', { sessionId: sid });
    await sleep(100);
    expect(await QueueEntry.countDocuments({ session: sid, active: true })).toBe(0);

    await brian.emitWithAck('queue:join', { sessionId: sid });
    await request(app).post('/api/rooms/end').set('Cookie', seller);
    const statuses = (await QueueEntry.find({ session: sid }).sort({ createdAt: 1 })).map((e) => e.status);
    expect(statuses).toEqual(['left', 'skipped', 'left', 'cancelled']);
  });

  it('keeps a buyer\'s place through a dropped connection', async () => {
    const { session, amina } = await liveRoomWithBuyers();
    await amina.emitWithAck('queue:join', { sessionId: session.id });
    amina.disconnect(); // no room:leave: like a page refresh or a network drop
    await sleep(300);
    expect(await QueueEntry.countDocuments({ session: session.id, status: 'waiting' })).toBe(1);
  });
});

describe('maskContacts', () => {
  it.each([
    ['call 0712345678', 'call •••'],
    ['+254 712 345 678 now', '••• now'],
    ['254712345678', '•••'],
    ['0110-123-456', '•••'],
    ['see www.mybiz.com/tv', 'see •••'],
    ['go to https://wa.me/254712345678', 'go to •••'],
    ['shop at hisense.co.ke', 'shop at •••'],
    ['email me jane@mail.com', 'email me •••'],
  ])('masks %s', (input, out) => expect(maskContacts(input)).toBe(out));

  it.each(['Is the 55" TV KES 54,999?', 'Do you have 2 in black?', 'I need it by 5.30pm. OK?'])(
    'leaves normal messages alone: %s',
    (text) => expect(maskContacts(text)).toBe(text),
  );
});
