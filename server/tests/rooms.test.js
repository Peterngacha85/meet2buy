import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { io as connect } from 'socket.io-client';

// Tokens are signed for real (no network); closing a LiveKit room would call LiveKit Cloud, so it is stubbed.
vi.mock('../src/services/livekit.js', async (importOriginal) => ({
  ...(await importOriginal()),
  closeLiveKitRoom: vi.fn(async () => {}),
}));

const { createApp } = await import('../src/app.js');
const { initSockets } = await import('../src/sockets/index.js');
const { User } = await import('../src/models/User.js');
const { Store } = await import('../src/models/Store.js');
const { RoomSession } = await import('../src/models/RoomSession.js');
const { ChatMessage } = await import('../src/models/ChatMessage.js');
const { closeLiveKitRoom } = await import('../src/services/livekit.js');
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
