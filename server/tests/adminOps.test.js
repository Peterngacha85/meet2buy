import http from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { io as connect } from 'socket.io-client';

let stkCount = 0;
vi.mock('../src/services/mpesa.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isSimulated: () => false,
  isStkConfigured: () => true,
  isB2BConfigured: () => true,
  stkPush: vi.fn(async () => {
    stkCount += 1;
    return { MerchantRequestID: `mr_${stkCount}`, CheckoutRequestID: `ws_CO_${stkCount}`, ResponseCode: '0' };
  }),
  stkQuery: vi.fn(async () => ({ done: false })),
  b2bPayment: vi.fn(async ({ relatedId }) => ({ ConversationID: `AG_${relatedId}_${Date.now()}`, OriginatorConversationID: `oc_${relatedId}` })),
  transactionStatus: vi.fn(async () => ({})),
}));
vi.mock('../src/services/livekit.js', async (importOriginal) => ({
  ...(await importOriginal()),
  closeLiveKitRoom: vi.fn(async () => {}),
  setCounterPublish: vi.fn(async () => true),
}));

const { createApp } = await import('../src/app.js');
const { initSockets } = await import('../src/sockets/index.js');
const { User } = await import('../src/models/User.js');
const { RoomSession } = await import('../src/models/RoomSession.js');
const { Order, Payment, Payout } = await import('../src/models/Commerce.js');
const mpesa = await import('../src/services/mpesa.js');

const app = createApp();
const server = http.createServer(app);
let baseUrl;
const sockets = [];
beforeAll(async () => {
  initSockets(server);
  await new Promise((r) => server.listen(0, r));
  baseUrl = `http://localhost:${server.address().port}`;
});
afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await new Promise((r) => server.close(r));
});
beforeEach(() => vi.clearAllMocks());

const TOKEN = 'test-callback-token';
const cookieFrom = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('m2b_token='))?.split(';')[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out waiting');
    await sleep(25);
  }
}
async function loginAs(role, email, name, extra = {}) {
  await User.create({ name, email, phone: '254733000222', password: 'supersecret1', role, ...extra });
  return cookieFrom(await request(app).post('/api/auth/login').send({ email, password: 'supersecret1' }));
}
function socketAs(cookie) {
  const s = connect(baseUrl, { transports: ['websocket'], forceNew: true, extraHeaders: cookie ? { Cookie: cookie } : {} });
  sockets.push(s);
  return new Promise((resolve, reject) => {
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

async function setup() {
  const res = await request(app)
    .post('/api/auth/register-seller')
    .send({
      account: { name: 'Grace Achieng', email: 'grace@shop.test', phone: '0722 000 111', password: 'supersecret1' },
      store: { name: 'Grace Fashion', departments: [{ name: 'Shirts', wing: 'home-appliances' }] },
      payout: { type: 'till', tillNumber: '123 456', registeredName: 'GRACE FASHION' },
    });
  const seller = cookieFrom(res);
  const store = res.body.data.store;
  const admin = await loginAs('admin', 'boss@meet2buy.test', 'Boss');
  await request(app).patch(`/api/admin/sellers/${store.id}/approve`).set('Cookie', admin);
  const p = await request(app)
    .post('/api/products')
    .set('Cookie', seller)
    .send({ name: 'Khaki shirt', price: 2500, stock: 5, department: store.departments[0].id });
  const buyer = await loginAs('buyer', 'amina@example.com', 'Amina Wanjiru');
  return { seller, admin, buyer, store, product: p.body.data.product };
}

async function buy(buyer, productId) {
  const res = await request(app)
    .post('/api/orders/checkout')
    .set('Cookie', buyer)
    .send({ productId, mpesaPhone: '0712345678', delivery: { name: 'Amina', phone: '0712345678', location: 'Kilimani' } });
  const order = await Order.findById(res.body.data.order.id);
  return { order, payment: await Payment.findById(order.payment) };
}
function stkPaid(checkoutRequestId, amount, receipt) {
  return request(app)
    .post(`/api/mpesa/stk/callback?t=${TOKEN}`)
    .send({
      Body: {
        stkCallback: {
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: 'ok',
          CallbackMetadata: { Item: [{ Name: 'Amount', Value: amount }, { Name: 'MpesaReceiptNumber', Value: receipt }] },
        },
      },
    });
}

describe('Admin: overview, transactions, settings, users', () => {
  it('shows real numbers, only to admins', async () => {
    const { admin, buyer, product } = await setup();
    const { order, payment } = await buy(buyer, product.id);
    await stkPaid(payment.checkoutRequestId, 2500, 'RCPT1');
    await until(async () => (await Order.findById(order._id)).status === 'paid');

    expect((await request(app).get('/api/admin/stats').set('Cookie', buyer)).status).toBe(403);
    const s = (await request(app).get('/api/admin/stats').set('Cookie', admin)).body.data.stats;
    expect(s).toMatchObject({ today: { sales: 2500, commission: 200, orders: 1 }, sellers: 1, pending: 0, buyers: 1 });

    const t = (await request(app).get('/api/admin/transactions?status=sold').set('Cookie', admin)).body.data;
    expect(t.totals).toEqual({ sales: 2500, commission: 200 });
    expect(t.orders[0]).toMatchObject({ amount: 2500, payment: { receipt: 'RCPT1' }, store: { name: 'Grace Fashion' }, buyer: { name: 'Amina Wanjiru' } });
  });

  it('changes settings with limits and sets a per-shop commission', async () => {
    const { admin, store } = await setup();
    const bad = await request(app).patch('/api/admin/settings').set('Cookie', admin).send({ defaultCommissionRate: 90 });
    expect(bad.status).toBe(400);
    const good = await request(app).patch('/api/admin/settings').set('Cookie', admin).send({ defaultCommissionRate: 10, counterTimeLimitMinutes: 7 });
    expect(good.body.data.settings).toMatchObject({ defaultCommissionRate: 10, counterTimeLimitMinutes: 7 });

    const c = await request(app).patch(`/api/admin/sellers/${store.id}/commission`).set('Cookie', admin).send({ rate: 5 });
    expect(c.body.data.store.commissionRate).toBe(5);
    const cleared = await request(app).patch(`/api/admin/sellers/${store.id}/commission`).set('Cookie', admin).send({ rate: null });
    expect(cleared.body.data.store.commissionRate).toBeNull();
  });

  it('lists and suspends users, but never the owner admin or yourself', async () => {
    const { admin, buyer } = await setup();
    await User.create({ name: 'Owner', email: 'owner@meet2buy.test', phone: '254700000001', password: 'supersecret1', role: 'admin', isEnvOwner: true });
    const list = (await request(app).get('/api/admin/users?q=amina').set('Cookie', admin)).body.data.users;
    expect(list).toHaveLength(1);

    const amina = await User.findOne({ email: 'amina@example.com' });
    await request(app).patch(`/api/admin/users/${amina.id}/suspend`).set('Cookie', admin).send({ suspended: true });
    expect((await request(app).get('/api/auth/me').set('Cookie', buyer)).status).toBe(401); // logged out everywhere

    const owner = await User.findOne({ email: 'owner@meet2buy.test' });
    expect((await request(app).patch(`/api/admin/users/${owner.id}/suspend`).set('Cookie', admin).send({ suspended: true })).status).toBe(403);
    const me = await User.findOne({ email: 'boss@meet2buy.test' });
    expect((await request(app).patch(`/api/admin/users/${me.id}/suspend`).set('Cookie', admin).send({ suspended: true })).status).toBe(400);
  });
});

describe('Admin: held orders and payouts', () => {
  it('resolves a held order after checking M-Pesa: pay the seller, or cancel', async () => {
    const { admin, buyer, product } = await setup();
    const { order, payment } = await buy(buyer, product.id);
    await stkPaid(payment.checkoutRequestId, 100, 'SHORT1'); // wrong amount → on hold
    await until(async () => (await Order.findById(order._id)).status === 'on_hold');

    const noNote = await request(app).post(`/api/admin/orders/${order.id}/resolve`).set('Cookie', admin).send({ action: 'pay' });
    expect(noNote.status).toBe(400);
    const paid = await request(app)
      .post(`/api/admin/orders/${order.id}/resolve`)
      .set('Cookie', admin)
      .send({ action: 'pay', note: 'Buyer paid the balance by phone, statement checked' });
    expect(paid.body.data.order.status).toBe('paid');
    expect(await Payout.countDocuments({ order: order._id })).toBe(1);

    const second = await buy(buyer, product.id);
    await stkPaid(second.payment.checkoutRequestId, 7, 'SHORT2');
    await until(async () => (await Order.findById(second.order._id)).status === 'on_hold');
    await request(app).post(`/api/admin/orders/${second.order.id}/resolve`).set('Cookie', admin).send({ action: 'cancel', note: 'Refunded KES 7 to buyer' });
    expect(await Order.findById(second.order._id)).toMatchObject({ status: 'cancelled', stockReleased: true });
  });

  it('retries a failed payout only after asking M-Pesa whether it really failed', async () => {
    const { admin, buyer, product } = await setup();
    const { order, payment } = await buy(buyer, product.id);
    await stkPaid(payment.checkoutRequestId, 2500, 'RCPT9');
    const payout = await until(async () => {
      const p = await Payout.findOne({ order: order._id });
      return p?.conversationId ? p : null;
    });
    await request(app)
      .post(`/api/mpesa/b2b/result?t=${TOKEN}`)
      .send({ Result: { ResultCode: 2001, ResultDesc: 'The initiator information is invalid.', ConversationID: payout.conversationId } });
    await until(async () => (await Payout.findById(payout._id)).status === 'failed');

    const list = (await request(app).get('/api/admin/payouts?status=failed').set('Cookie', admin)).body.data;
    expect(list.payouts[0]).toMatchObject({ resultDesc: 'The initiator information is invalid.', wasAccepted: true, order: { orderNumber: order.orderNumber } });

    // 1st retry: status check first.
    const first = await request(app).post(`/api/admin/payouts/${payout.id}/retry`).set('Cookie', admin);
    expect(first.status).toBe(202);
    expect(mpesa.transactionStatus).toHaveBeenCalledTimes(1);
    // Too soon: still waiting for the answer.
    expect((await request(app).post(`/api/admin/payouts/${payout.id}/retry`).set('Cookie', admin)).status).toBe(409);

    // A minute later with no "completed" answer: send again.
    await Payout.updateOne(
      { _id: payout._id },
      { lastAttemptAt: new Date(Date.now() - 3 * 60_000), statusCheckedAt: new Date(Date.now() - 2 * 60_000) },
    );
    const again = await request(app).post(`/api/admin/payouts/${payout.id}/retry`).set('Cookie', admin);
    expect(again.status).toBe(200);
    expect(again.body.data.payout.status).toBe('processing');
    expect(mpesa.b2bPayment).toHaveBeenCalledTimes(2);
    expect((await Payout.findById(payout._id)).attempts).toBe(2);

    // Completed payouts can't be retried.
    const done = await Payout.findById(payout._id);
    await request(app).post(`/api/mpesa/b2b/result?t=${TOKEN}`).send({ Result: { ResultCode: 0, ResultDesc: 'ok', ConversationID: done.conversationId, TransactionID: 'TXOK' } });
    await until(async () => (await Payout.findById(payout._id)).status === 'completed');
    expect((await request(app).post(`/api/admin/payouts/${payout.id}/retry`).set('Cookie', admin)).status).toBe(409);
  });
});

describe('Admin: live rooms', () => {
  it('lists live rooms, watches invisibly, and closes a room', async () => {
    const { admin, seller, buyer } = await setup();
    const { session } = (await request(app).post('/api/rooms/start').set('Cookie', seller)).body.data;
    const sellerSocket = await socketAs(seller);
    await sellerSocket.emitWithAck('room:join', { sessionId: session.id });
    const b = await socketAs(buyer);
    await b.emitWithAck('room:join', { sessionId: session.id });

    const rooms = (await request(app).get('/api/admin/rooms/live').set('Cookie', admin)).body.data.rooms;
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ id: session.id, store: { name: 'Grace Fashion' }, viewers: 1, sellerHere: true, waiting: 0 });

    // Hidden, watch-only video token.
    const watch = (await request(app).post(`/api/admin/rooms/${session.id}/watch`).set('Cookie', admin)).body.data;
    expect(jwt.decode(watch.livekit.token).video).toMatchObject({ canPublish: false, canSubscribe: true, hidden: true });

    // Observer socket: gets the queue, isn't counted, can't chat.
    const a = await socketAs(admin);
    const state = await a.emitWithAck('room:join', { sessionId: session.id, observe: true });
    expect(state).toMatchObject({ ok: true, isObserver: true, canChat: false, queue: [] });
    expect((await request(app).get('/api/admin/rooms/live').set('Cookie', admin)).body.data.rooms[0].viewers).toBe(1);
    expect(await a.emitWithAck('chat:send', { sessionId: session.id, body: 'hi' })).toMatchObject({ ok: false });

    const closed = new Promise((r) => b.once('room:closed', r));
    await request(app).post(`/api/admin/rooms/${session.id}/close`).set('Cookie', admin).send({ reason: 'Selling fake goods' });
    expect(await closed).toMatchObject({ reason: 'admin' });
    expect((await RoomSession.findById(session.id)).endReason).toBe('admin');
  });
});
