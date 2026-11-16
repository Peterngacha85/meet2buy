import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Order, newOrderNumber } from '../src/models/Commerce.js';
import { SupportTicket } from '../src/models/SupportTicket.js';

const app = createApp();
const cookieFrom = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('m2b_token='))?.split(';')[0];

async function loginAs(role, email, name) {
  await User.create({ name, email, phone: '254733000222', password: 'supersecret1', role });
  return cookieFrom(await request(app).post('/api/auth/login').send({ email, password: 'supersecret1' }));
}

async function setup(status = 'delivered') {
  const res = await request(app)
    .post('/api/auth/register-seller')
    .send({
      account: { name: 'Grace Achieng', email: 'grace@shop.test', phone: '0722 000 111', password: 'supersecret1' },
      store: { name: 'Grace Phones', departments: [{ name: 'Phones', wing: 'phones-and-tablets' }] },
      payout: { type: 'till', tillNumber: '123 456', registeredName: 'GRACE PHONES' },
      acceptTerms: true,
    });
  const seller = cookieFrom(res);
  const store = res.body.data.store;
  const buyer = await loginAs('buyer', 'amina@example.com', 'Amina Wanjiru');
  const admin = await loginAs('admin', 'boss@meet2buy.test', 'Boss');
  const amina = await User.findOne({ email: 'amina@example.com' });
  const order = await Order.create({
    orderNumber: newOrderNumber(),
    buyer: amina._id,
    store: store.id,
    items: [{ product: amina._id, name: 'Galaxy A55', quantity: 1, unitPrice: 45_000 }],
    amount: 45_000,
    delivery: { name: 'Amina', phone: '254712345678', location: 'Kilimani' },
    status,
    receiptNumber: 'RCT-2026-000009',
  });
  return { seller, buyer, admin, order };
}

const open = (cookie, body) => request(app).post('/api/support').set('Cookie', cookie).send(body);

describe('After-sales requests', () => {
  it('buyer raises a request, seller answers and resolves, buyer reopens and escalates, admin closes', async () => {
    const { seller, buyer, admin, order } = await setup();

    // Validation and one active request per order.
    expect((await open(buyer, { orderId: order.id, category: 'faulty', description: 'short' })).status).toBe(400);
    const created = await open(buyer, {
      orderId: order.id,
      category: 'faulty',
      description: 'The screen flickers after charging. IMEI 356938035643809.',
    });
    expect(created.status).toBe(201);
    const t = created.body.data.ticket;
    expect(t).toMatchObject({
      ticketNumber: 'AS-000001',
      status: 'open',
      categoryLabel: 'Faulty / not working',
      receiptNumber: 'RCT-2026-000009',
      viewerRole: 'buyer',
      store: { name: 'Grace Phones' },
    });
    // IMEIs and serials stay readable (not masked like room chat).
    expect(t.messages[0].body).toContain('356938035643809');
    const dup = await open(buyer, { orderId: order.id, category: 'other', description: 'Another problem here' });
    expect(dup.status).toBe(409);
    expect(dup.body.errors[0]).toMatchObject({ field: 'ticket', message: t.id });

    // Seller sees it in their list and badge.
    const list = (await request(app).get('/api/support/store').set('Cookie', seller)).body.data.tickets;
    expect(list).toMatchObject([{ ticketNumber: 'AS-000001', buyer: 'Amina Wanjiru', order: order.id }]);
    expect((await request(app).get('/api/auth/badges').set('Cookie', seller)).body.data.badges.support).toBe(1);

    // Seller replies (→ in progress), then resolves with a note.
    const reply = await request(app).post(`/api/support/${t.id}/messages`).set('Cookie', seller).send({ body: 'Bring it to the shop for a free check.' });
    expect(reply.body.data.ticket).toMatchObject({ status: 'in_progress', viewerRole: 'seller' });
    expect(reply.body.data.ticket.messages[1]).toMatchObject({ role: 'seller', name: 'Grace Phones' });
    // Sellers can't escalate or close; buyers can't resolve.
    expect((await request(app).patch(`/api/support/${t.id}/status`).set('Cookie', seller).send({ status: 'closed' })).status).toBe(409);
    expect((await request(app).patch(`/api/support/${t.id}/status`).set('Cookie', buyer).send({ status: 'resolved' })).status).toBe(409);
    const resolved = await request(app).patch(`/api/support/${t.id}/status`).set('Cookie', seller).send({ status: 'resolved', note: 'Screen replaced under warranty.' });
    expect(resolved.body.data.ticket.status).toBe('resolved');
    expect(resolved.body.data.ticket.actions).toEqual([]);

    // Buyer writing on a resolved request reopens it; then asks Meet2buy to step in.
    const again = await request(app).post(`/api/support/${t.id}/messages`).set('Cookie', buyer).send({ body: 'It is flickering again.' });
    expect(again.body.data.ticket.status).toBe('open');
    const esc = await request(app).patch(`/api/support/${t.id}/status`).set('Cookie', buyer).send({ status: 'escalated' });
    expect(esc.body.data.ticket.status).toBe('escalated');
    expect((await request(app).get('/api/auth/badges').set('Cookie', admin)).body.data.badges.support).toBe(1);

    // Admin sees escalated requests, replies as Meet2buy support and closes.
    const escalated = (await request(app).get('/api/support?status=escalated').set('Cookie', admin)).body.data.tickets;
    expect(escalated.map((x) => x.id)).toEqual([t.id]);
    await request(app).post(`/api/support/${t.id}/messages`).set('Cookie', admin).send({ body: 'We have asked the seller to replace the phone.' });
    const closed = await request(app).patch(`/api/support/${t.id}/status`).set('Cookie', admin).send({ status: 'closed' });
    expect(closed.body.data.ticket.status).toBe('closed');
    expect((await request(app).post(`/api/support/${t.id}/messages`).set('Cookie', buyer).send({ body: 'hello' })).status).toBe(409);

    const stored = await SupportTicket.findById(t.id);
    expect(stored.messages.map((m) => m.role)).toEqual(['buyer', 'seller', 'seller', 'system', 'buyer', 'system', 'admin', 'system']);

    // Closed: a new request for the same order is allowed.
    expect((await open(buyer, { orderId: order.id, category: 'warranty', description: 'Battery drains very fast now.' })).status).toBe(201);
  });

  it('only the buyer, the shop and admins can see a request; unpaid orders cannot have one', async () => {
    const { buyer, order } = await setup();
    const t = (await open(buyer, { orderId: order.id, category: 'not_delivered', description: 'Nothing arrived after 5 days.' })).body.data.ticket;
    const stranger = await loginAs('buyer', 'baraka@example.com', 'Baraka');
    expect((await request(app).get(`/api/support/${t.id}`).set('Cookie', stranger)).status).toBe(404);
    expect((await open(stranger, { orderId: order.id, category: 'other', description: 'Not my order at all' })).status).toBe(404);
    expect((await request(app).get('/api/support').set('Cookie', buyer)).status).toBe(403);

    const unpaid = await setupUnpaid();
    expect((await open(unpaid.buyer, { orderId: unpaid.order.id, category: 'other', description: 'Where is my order?' })).status).toBe(409);
  });

  it('lets buyers sign after-sales photo uploads only', async () => {
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');
    const res = await request(app).post('/api/uploads/signature').set('Cookie', buyer).send({ kind: 'support' });
    expect([200, 503]).toContain(res.status); // 503 when Cloudinary keys are absent in the test env
    expect((await request(app).post('/api/uploads/signature').set('Cookie', buyer).send({ kind: 'product' })).status).toBe(403);
  });
});

async function setupUnpaid() {
  const buyer = await loginAs('buyer', 'wanjiru@example.com', 'Wanjiru');
  const u = await User.findOne({ email: 'wanjiru@example.com' });
  const order = await Order.create({
    orderNumber: newOrderNumber(),
    buyer: u._id,
    store: u._id,
    items: [{ product: u._id, name: 'X', quantity: 1, unitPrice: 100 }],
    amount: 100,
    delivery: { name: 'W', phone: '254712345678', location: 'Nairobi' },
    status: 'awaiting_payment',
  });
  return { buyer, order };
}
