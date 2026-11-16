import http from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { io as connect } from 'socket.io-client';

// Daraja is mocked: STK pushes and B2B requests are "accepted"; tests post the callbacks Safaricom would send.
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
  b2bPayment: vi.fn(async ({ relatedId }) => ({ ConversationID: `AG_${relatedId}`, OriginatorConversationID: `oc_${relatedId}` })),
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
const { Store } = await import('../src/models/Store.js');
const { Product } = await import('../src/models/Product.js');
const { Settings } = await import('../src/models/Settings.js');
const { Order, Payment, Payout, Offer, MpesaLog } = await import('../src/models/Commerce.js');
const mpesa = await import('../src/services/mpesa.js');
const { sweepUnpaidOrders } = await import('../src/services/orderService.js');

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

async function loginAs(role, email, name) {
  await User.create({ name, email, phone: '254733000222', password: 'supersecret1', role });
  return cookieFrom(await request(app).post('/api/auth/login').send({ email, password: 'supersecret1' }));
}

async function shopWithProduct({ stock = 2, price = 2500, variants = [] } = {}) {
  const res = await request(app)
    .post('/api/auth/register-seller')
    .send({
      account: { name: 'Grace Achieng', email: 'grace@shop.test', phone: '0722 000 111', password: 'supersecret1' },
      store: { name: 'Grace Fashion', departments: [{ name: 'Shirts', wing: 'home-appliances' }] },
      payout: { type: 'till', tillNumber: '123 456', registeredName: 'GRACE FASHION' },
      acceptTerms: true,
    });
  const seller = cookieFrom(res);
  const store = res.body.data.store;
  const admin = await loginAs('admin', 'boss@meet2buy.test', 'Boss');
  await request(app).patch(`/api/admin/sellers/${store.id}/approve`).set('Cookie', admin);
  const p = await request(app)
    .post('/api/products')
    .set('Cookie', seller)
    .send({ name: 'Khaki shirt', price, stock, variants, department: store.departments[0].id });
  return { seller, admin, store, product: p.body.data.product };
}

const delivery = { name: 'Amina Wanjiru', phone: '0712 345 678', location: 'Kilimani, Nairobi', notes: 'Call at the gate' };

function checkout(cookie, body) {
  return request(app).post('/api/orders/checkout').set('Cookie', cookie).send({ mpesaPhone: '0712345678', delivery, ...body });
}

function stkCallback(checkoutRequestId, { code = 0, amount, receipt = 'SKA1B2C3D4' } = {}) {
  const body = {
    Body: {
      stkCallback: {
        MerchantRequestID: 'mr',
        CheckoutRequestID: checkoutRequestId,
        ResultCode: code,
        ResultDesc: code === 0 ? 'The service request is processed successfully.' : 'Request cancelled by user',
        ...(code === 0
          ? {
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: amount },
                  { Name: 'MpesaReceiptNumber', Value: receipt },
                  { Name: 'PhoneNumber', Value: 254712345678 },
                ],
              },
            }
          : {}),
      },
    },
  };
  return request(app).post(`/api/mpesa/stk/callback?t=${TOKEN}`).send(body);
}

const b2bResult = (conversationId, code = 0) =>
  request(app)
    .post(`/api/mpesa/b2b/result?t=${TOKEN}`)
    .send({ Result: { ResultType: 0, ResultCode: code, ResultDesc: code ? 'Insufficient funds' : 'Success', ConversationID: conversationId, OriginatorConversationID: 'x', TransactionID: 'TX123' } });

describe('Checkout → STK → payout', () => {
  it('charges the database price, pays the order, takes commission and pays the seller', async () => {
    const { product, store, seller } = await shopWithProduct();
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina Wanjiru');

    // A price sent by the browser is ignored: the amount comes from the product.
    const res = await checkout(buyer, { productId: product.id, quantity: 2, amount: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.order).toMatchObject({ status: 'awaiting_payment', amount: 5000, store: { phone: null } });
    expect(mpesa.stkPush).toHaveBeenCalledWith(expect.objectContaining({ phone: '254712345678', amount: 5000 }));
    expect((await Product.findById(product.id)).stock).toBe(0); // reserved

    const order = await Order.findById(res.body.data.order.id);
    const payment = await Payment.findById(order.payment);
    expect((await stkCallback(payment.checkoutRequestId, { amount: 5000 })).body).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });

    const paid = await until(async () => {
      const o = await Order.findById(order._id);
      return o.status === 'paid' && o.payout ? o : null;
    });
    // KES 2,500 each is below every price band → default 2%: KES 100 commission, KES 4,900 to the seller.
    expect(paid).toMatchObject({ commissionRate: 2, commissionAmount: 100, payoutAmount: 4900 });
    const payout = await until(async () => {
      const p = await Payout.findById(paid.payout);
      return p?.conversationId ? p : null; // B2B request accepted by Safaricom
    });
    expect(payout).toMatchObject({ status: 'processing', amount: 4900, destinationType: 'till', destination: '123456', attempts: 1 });
    expect(mpesa.b2bPayment).toHaveBeenCalledWith(expect.objectContaining({ destination: '123456', amount: 4900 }));

    await b2bResult(payout.conversationId);
    await until(async () => (await Payout.findById(payout._id)).status === 'completed');

    // Raw callbacks are logged.
    expect(await MpesaLog.countDocuments({ type: 'stk_callback' })).toBe(1);

    // Buyer now sees the seller's phone; the seller sees the order with delivery details and payout.
    const mine = await request(app).get('/api/orders/mine').set('Cookie', buyer);
    expect(mine.body.data.orders[0]).toMatchObject({ status: 'paid', store: { name: 'Grace Fashion', phone: '254722000111' } });
    const theirs = await request(app).get('/api/orders/store').set('Cookie', seller);
    expect(theirs.body.data.orders[0]).toMatchObject({
      receipt: 'SKA1B2C3D4',
      payoutAmount: 4900,
      delivery: { phone: '254712345678', location: 'Kilimani, Nairobi' },
      payout: { status: 'completed', transactionId: 'TX123' },
    });
    expect((await request(app).get('/api/auth/badges').set('Cookie', seller)).body.data.badges).toMatchObject({ orders: 1 });

    // Seller marks it shipped, then delivered; it can't go back.
    const ship = await request(app).patch(`/api/orders/${order.id}/fulfilment`).set('Cookie', seller).send({ status: 'shipped' });
    expect(ship.body.data.order.status).toBe('shipped');
    expect((await request(app).patch(`/api/orders/${order.id}/fulfilment`).set('Cookie', seller).send({ status: 'shipped' })).status).toBe(409);
    expect(store.id).toBeTruthy();
  });

  it('creates only one payout when the callback arrives twice', async () => {
    const { product } = await shopWithProduct();
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');
    const order = await Order.findById((await checkout(buyer, { productId: product.id })).body.data.order.id);
    const { checkoutRequestId } = await Payment.findById(order.payment);

    await Promise.all([stkCallback(checkoutRequestId, { amount: 2500 }), stkCallback(checkoutRequestId, { amount: 2500 })]);
    await until(async () => (await Payout.countDocuments()) === 1);
    await sleep(200);
    expect(await Payout.countDocuments()).toBe(1);
    expect(mpesa.b2bPayment).toHaveBeenCalledTimes(1);
  });

  it('releases stock exactly once when the buyer cancels, and never pays out', async () => {
    const { product } = await shopWithProduct({ stock: 3 });
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');
    const order = await Order.findById((await checkout(buyer, { productId: product.id, quantity: 2 })).body.data.order.id);
    expect((await Product.findById(product.id)).stock).toBe(1);
    const { checkoutRequestId } = await Payment.findById(order.payment);

    await stkCallback(checkoutRequestId, { code: 1032 });
    await stkCallback(checkoutRequestId, { code: 1032 });
    await until(async () => (await Order.findById(order._id)).status === 'payment_failed');
    await sleep(100);
    expect((await Product.findById(product.id)).stock).toBe(3);
    expect((await Payment.findById(order.payment)).status).toBe('cancelled');
    expect(await Payout.countDocuments()).toBe(0);
  });

  it('gives the last unit to one buyer only', async () => {
    const { product } = await shopWithProduct({ stock: 1 });
    const a = await loginAs('buyer', 'a@example.com', 'A');
    const b = await loginAs('buyer', 'b@example.com', 'B');
    const [ra, rb] = await Promise.all([checkout(a, { productId: product.id }), checkout(b, { productId: product.id })]);
    expect([ra.status, rb.status].sort()).toEqual([201, 409]);
    expect(mpesa.stkPush).toHaveBeenCalledTimes(1);
  });

  it('holds the order without paying out when the paid amount does not match', async () => {
    const { product } = await shopWithProduct();
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');
    const order = await Order.findById((await checkout(buyer, { productId: product.id })).body.data.order.id);
    await stkCallback((await Payment.findById(order.payment)).checkoutRequestId, { amount: 10 });
    const held = await until(async () => {
      const o = await Order.findById(order._id);
      return o.status === 'on_hold' ? o : null;
    });
    expect(held.holdReason).toBe('amount_mismatch');
    expect(await Payout.countDocuments()).toBe(0);
  });

  it('applies a shop commission override and keeps the snapshot when the rate changes later', async () => {
    const { product, store } = await shopWithProduct();
    await Store.updateOne({ _id: store.id }, { commissionRate: 5 });
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');
    const order = await Order.findById((await checkout(buyer, { productId: product.id })).body.data.order.id);
    await stkCallback((await Payment.findById(order.payment)).checkoutRequestId, { amount: 2500 });
    await until(async () => (await Order.findById(order._id)).status === 'paid');

    await Store.updateOne({ _id: store.id }, { commissionRate: 20 });
    await Settings.updateOne({ key: 'global' }, { defaultCommissionRate: 15 });
    expect(await Order.findById(order._id)).toMatchObject({ commissionRate: 5, commissionAmount: 125, payoutAmount: 2375 });
  });

  it('issues a numbered receipt on payment: buyer, seller and admin copies, nobody else', async () => {
    const { seller, admin, product } = await shopWithProduct({ stock: 5 });
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');
    const pay = async () => {
      const order = await Order.findById((await checkout(buyer, { productId: product.id })).body.data.order.id);
      // Not paid yet: no receipt.
      expect((await request(app).get(`/api/orders/${order.id}/receipt`).set('Cookie', buyer)).status).toBe(409);
      await stkCallback((await Payment.findById(order.payment)).checkoutRequestId, { amount: 2500, receipt: `RC${order.id.slice(-6)}` });
      return until(async () => {
        const o = await Order.findById(order._id);
        return o.receiptNumber ? o : null;
      });
    };
    const first = await pay();
    const second = await pay();
    const year = new Date().getFullYear();
    expect(first.receiptNumber).toBe(`RCT-${year}-000001`);
    expect(second.receiptNumber).toBe(`RCT-${year}-000002`);

    const mine = (await request(app).get(`/api/orders/${first.id}/receipt`).set('Cookie', buyer)).body.data.receipt;
    expect(mine).toMatchObject({
      copy: 'buyer',
      receiptNumber: first.receiptNumber,
      amount: 2500,
      store: { name: 'Grace Fashion' },
      items: [{ name: 'Khaki shirt', quantity: 1, unitPrice: 2500, total: 2500 }],
      payment: { method: 'M-Pesa', phone: '0712 ••• 678' },
    });
    expect(mine.settlement).toBeUndefined(); // the buyer doesn't see commission

    const sellerCopy = (await request(app).get(`/api/orders/${first.id}/receipt`).set('Cookie', seller)).body.data.receipt;
    expect(sellerCopy).toMatchObject({ copy: 'seller', settlement: { commissionRate: 2, commissionAmount: 50, payoutAmount: 2450 } });
    expect((await request(app).get(`/api/orders/${first.id}/receipt`).set('Cookie', admin)).body.data.receipt.copy).toBe('admin');

    const stranger = await loginAs('buyer', 'baraka@example.com', 'Baraka');
    expect((await request(app).get(`/api/orders/${first.id}/receipt`).set('Cookie', stranger)).status).toBe(404);

    // Lists carry the receipt number; admins can search by it.
    expect((await request(app).get('/api/orders/mine').set('Cookie', buyer)).body.data.orders[0].receiptNumber).toMatch(/^RCT-/);
    const found = (await request(app).get(`/api/admin/transactions?q=${second.receiptNumber}`).set('Cookie', admin)).body.data.orders;
    expect(found.map((o) => o.id)).toEqual([second.id]);
  });

  it('picks the commission from the price band of the unit price', async () => {
    const { product } = await shopWithProduct({ price: 25_000, stock: 5 });
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');
    // 2 × KES 25,000: the band is chosen per phone (Mid-range, 3%), not by the KES 50,000 total.
    const order = await Order.findById((await checkout(buyer, { productId: product.id, quantity: 2 })).body.data.order.id);
    await stkCallback((await Payment.findById(order.payment)).checkoutRequestId, { amount: 50_000 });
    const paid = await until(async () => {
      const o = await Order.findById(order._id);
      return o.status === 'paid' ? o : null;
    });
    expect(paid).toMatchObject({ commissionRate: 3, commissionAmount: 1500, payoutAmount: 48_500 });
  });

  it('pays to a Paybill with the seller\'s account number, and records a failed payout', async () => {
    const { product, store } = await shopWithProduct();
    await Store.updateOne(
      { _id: store.id },
      { payout: { type: 'paybill', paybillNumber: '222111', accountNumber: 'ACC-9', registeredName: 'GRACE', verified: true } },
    );
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');
    const order = await Order.findById((await checkout(buyer, { productId: product.id })).body.data.order.id);
    await stkCallback((await Payment.findById(order.payment)).checkoutRequestId, { amount: 2500 });
    await until(async () => (await Payout.findOne({ order: order._id }))?.conversationId || (await Payout.findOne({ order: order._id, status: 'failed' })));
    const payout = await Payout.findOne({ order: order._id });
    expect(payout.toJSON()).toMatchObject({ status: 'processing', destinationType: 'paybill', destination: '222111', accountReference: 'ACC-9' });

    await b2bResult(payout.conversationId, 1);
    const failed = await until(async () => {
      const p = await Payout.findById(payout._id);
      return p.status === 'failed' ? p : null;
    });
    expect(failed.resultDesc).toBe('Insufficient funds');
  });

  it('sells product variations: own price and stock per variation, reserved and returned exactly', async () => {
    const { seller, product } = await shopWithProduct({ price: 50_000, stock: 1 });
    const variants = [
      { label: 'Storage', options: ['128GB', '256GB'] },
      { label: 'Colour', options: ['Black', 'Blue'] },
    ];
    // A variation that doesn't match the options is refused.
    const bad = await request(app)
      .patch(`/api/products/${product.id}`)
      .set('Cookie', seller)
      .send({ variants, skus: [{ options: { Storage: '512GB', Colour: 'Black' }, price: 1, stock: 1 }] });
    expect(bad.status).toBe(400);
    const dup = await request(app)
      .patch(`/api/products/${product.id}`)
      .set('Cookie', seller)
      .send({
        variants,
        skus: [
          { options: { Storage: '128GB', Colour: 'Black' }, price: 50_000, stock: 1 },
          { options: { Storage: '128GB', Colour: 'Black' }, price: 52_000, stock: 1 },
        ],
      });
    expect(dup.status).toBe(400);

    const saved = await request(app)
      .patch(`/api/products/${product.id}`)
      .set('Cookie', seller)
      .send({
        variants,
        skus: [
          { options: { Storage: '128GB', Colour: 'Black' }, price: 50_000, stock: 2 },
          { options: { Storage: '256GB', Colour: 'Blue' }, price: 64_999, stock: 1 },
        ],
      });
    expect(saved.status).toBe(200);
    const p = saved.body.data.product;
    expect(p).toMatchObject({ price: 50_000, stock: 3 }); // lowest price, total stock
    const blue = p.skus.find((s) => s.options.Colour === 'Blue');
    expect(blue).toMatchObject({ price: 64_999, stock: 1, id: expect.any(String) });

    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');
    // Not stocked combination → refused; the stocked one is charged its own price.
    expect((await checkout(buyer, { productId: p.id, variant: { Storage: '256GB', Colour: 'Black' } })).status).toBe(409);
    const res = await checkout(buyer, { productId: p.id, variant: { Storage: '256GB', Colour: 'Blue' } });
    expect(res.status).toBe(201);
    expect(res.body.data.order).toMatchObject({ amount: 64_999, items: [{ variant: 'Storage: 256GB · Colour: Blue' }] });
    let stored = await Product.findById(p.id);
    expect(stored.stock).toBe(2);
    expect(stored.skus.id(blue.id).stock).toBe(0);
    // Sold out for the next shopper, even though the 128GB is in stock.
    const other = await loginAs('buyer', 'baraka@example.com', 'Baraka');
    expect((await checkout(other, { productId: p.id, variant: { Storage: '256GB', Colour: 'Blue' } })).status).toBe(409);

    // The seller edits the product meanwhile: the variation keeps its id, so a failed payment returns its stock.
    await request(app)
      .patch(`/api/products/${p.id}`)
      .set('Cookie', seller)
      .send({ skus: p.skus.map((s) => (s.id === blue.id ? { ...s, stock: 0 } : { ...s, price: 49_000 })) });
    const order = await Order.findById(res.body.data.order.id);
    await stkCallback((await Payment.findById(order.payment)).checkoutRequestId, { code: 1032 });
    stored = await until(async () => {
      const x = await Product.findById(p.id);
      return x.skus.id(blue.id)?.stock === 1 ? x : null;
    });
    expect(stored).toMatchObject({ stock: 3, price: 49_000 });
  });

  it('refuses shops whose payout number is not verified, bad numbers, and missing variants', async () => {
    const { product, store } = await shopWithProduct({ variants: [{ label: 'Size', options: ['M', 'L'] }] });
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');

    expect((await checkout(buyer, { productId: product.id, mpesaPhone: '12345' })).status).toBe(400);
    expect((await checkout(buyer, { productId: product.id })).status).toBe(400); // no size chosen
    const ok = await checkout(buyer, { productId: product.id, variant: { Size: 'L' } });
    expect(ok.body.data.order.items[0].variant).toBe('Size: L');

    await Store.updateOne({ _id: store.id }, { 'payout.verified': false });
    expect((await checkout(buyer, { productId: product.id, variant: { Size: 'M' } })).status).toBe(409);
  });

  it('cancels orders still unpaid after 5 minutes and returns their stock', async () => {
    const { product } = await shopWithProduct();
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');
    const order = await Order.findById((await checkout(buyer, { productId: product.id })).body.data.order.id);
    await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: new Date(Date.now() - 6 * 60_000) } });

    expect(await sweepUnpaidOrders()).toBe(1);
    expect(mpesa.stkQuery).toHaveBeenCalled();
    expect(await Order.findById(order._id)).toMatchObject({ status: 'cancelled', stockReleased: true });
    expect((await Payment.findById(order.payment)).status).toBe('timeout');
    expect((await Product.findById(product.id)).stock).toBe(2);

    // A success arriving after the cancel is flagged for the admin, never paid out automatically.
    await stkCallback((await Payment.findById(order.payment)).checkoutRequestId, { amount: 2500, receipt: 'LATE123' });
    const late = await until(async () => {
      const o = await Order.findById(order._id);
      return o.status === 'on_hold' ? o : null;
    });
    expect(late.holdReason).toBe('late_payment');
    expect(await Payout.countDocuments()).toBe(0);
  });

  it('ignores callbacks without the secret token', async () => {
    const { product } = await shopWithProduct();
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina');
    const order = await Order.findById((await checkout(buyer, { productId: product.id })).body.data.order.id);
    const { checkoutRequestId } = await Payment.findById(order.payment);
    const forged = await request(app)
      .post('/api/mpesa/stk/callback')
      .send({ Body: { stkCallback: { CheckoutRequestID: checkoutRequestId, ResultCode: 0, CallbackMetadata: { Item: [{ Name: 'Amount', Value: 2500 }, { Name: 'MpesaReceiptNumber', Value: 'FAKE' }] } } } });
    expect(forged.status).toBe(200);
    await sleep(150);
    expect((await Order.findById(order._id)).status).toBe('awaiting_payment');
  });
});

describe('Offers in the room', () => {
  function socketAs(cookie) {
    const s = connect(baseUrl, { transports: ['websocket'], forceNew: true, extraHeaders: { Cookie: cookie } });
    sockets.push(s);
    return new Promise((resolve, reject) => {
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
  }
  const nextEvent = (s, e) => new Promise((r) => s.once(e, r));

  it('sends an offer, locks it during checkout, unlocks it on failure and marks it paid on success', async () => {
    const { seller, product } = await shopWithProduct({ stock: 5, price: 3000 });
    const { session } = (await request(app).post('/api/rooms/start').set('Cookie', seller)).body.data;
    const buyerCookie = await loginAs('buyer', 'amina@example.com', 'Amina Wanjiru');
    const amina = await User.findOne({ email: 'amina@example.com' });

    const s = await socketAs(seller);
    await s.emitWithAck('room:join', { sessionId: session.id });
    const b = await socketAs(buyerCookie);
    await b.emitWithAck('room:join', { sessionId: session.id });

    const received = nextEvent(b, 'offer:received');
    const sent = await s.emitWithAck('offer:create', { sessionId: session.id, buyerId: amina.id, productId: product.id, quantity: 2, price: 5500 });
    expect(sent).toMatchObject({ ok: true, offer: { price: 5500, quantity: 2, status: 'pending' } });
    const offer = await received;
    expect(offer.product.name).toBe('Khaki shirt');

    // Buyers can't make offers.
    expect(await b.emitWithAck('offer:create', { sessionId: session.id, buyerId: amina.id, productId: product.id, quantity: 1, price: 1 })).toMatchObject({ ok: false });

    // Checkout at the offer price (not 2 × 3000).
    const first = await checkout(buyerCookie, { offerId: offer.id });
    expect(first.body.data.order.amount).toBe(5500);
    expect((await Offer.findById(offer.id)).status).toBe('in_checkout');
    expect((await checkout(buyerCookie, { offerId: offer.id })).status).toBe(409); // locked

    const firstOrder = await Order.findById(first.body.data.order.id);
    await stkCallback((await Payment.findById(firstOrder.payment)).checkoutRequestId, { code: 1 });
    await until(async () => (await Offer.findById(offer.id)).status === 'pending');

    const second = await checkout(buyerCookie, { offerId: offer.id });
    const secondOrder = await Order.findById(second.body.data.order.id);
    const celebration = nextEvent(b, 'sale:celebration');
    const status = nextEvent(b, 'payment:status');
    await stkCallback((await Payment.findById(secondOrder.payment)).checkoutRequestId, { amount: 5500, receipt: 'OFFER1' });
    expect(await status).toMatchObject({ status: 'success', receipt: 'OFFER1' });
    expect(await celebration).toMatchObject({ productName: 'Khaki shirt' });
    expect((await Offer.findById(offer.id)).status).toBe('paid');
    expect((await Order.findById(secondOrder._id)).session.toString()).toBe(session.id);

    // Declining a new offer.
    const again = await s.emitWithAck('offer:create', { sessionId: session.id, buyerId: amina.id, productId: product.id, quantity: 1, price: 2800 });
    expect(await b.emitWithAck('offer:decline', { offerId: again.offer.id })).toMatchObject({ ok: true });
    expect((await Offer.findById(again.offer.id)).status).toBe('declined');
  });

  it('offers a specific variation: its label, its stock, reserved on checkout', async () => {
    const { seller, product } = await shopWithProduct({ stock: 1, price: 3000 });
    const { product: p } = (
      await request(app)
        .patch(`/api/products/${product.id}`)
        .set('Cookie', seller)
        .send({
          variants: [{ label: 'Size', options: ['M', 'L'] }],
          skus: [
            { options: { Size: 'M' }, price: 3000, stock: 4 },
            { options: { Size: 'L' }, price: 3200, stock: 1 },
          ],
        })
    ).body.data;
    const large = p.skus.find((x) => x.options.Size === 'L');
    const { session } = (await request(app).post('/api/rooms/start').set('Cookie', seller)).body.data;
    const buyerCookie = await loginAs('buyer', 'amina@example.com', 'Amina Wanjiru');
    const amina = await User.findOne({ email: 'amina@example.com' });
    const s = await socketAs(seller);
    await s.emitWithAck('room:join', { sessionId: session.id });
    const b = await socketAs(buyerCookie);
    await b.emitWithAck('room:join', { sessionId: session.id });

    const base = { sessionId: session.id, buyerId: amina.id, productId: p.id };
    expect(await s.emitWithAck('offer:create', { ...base, quantity: 1, price: 3000 })).toMatchObject({ ok: false }); // which one?
    expect(await s.emitWithAck('offer:create', { ...base, skuId: large.id, quantity: 2, price: 6000 })).toMatchObject({ ok: false }); // only 1 L
    const sent = await s.emitWithAck('offer:create', { ...base, skuId: large.id, quantity: 1, price: 3000 });
    expect(sent.offer).toMatchObject({ variant: 'Size: L', product: { price: 3200 } });

    const res = await checkout(buyerCookie, { offerId: sent.offer.id });
    expect(res.body.data.order).toMatchObject({ amount: 3000, items: [{ variant: 'Size: L' }] });
    const stored = await Product.findById(p.id);
    expect(stored.skus.id(large.id).stock).toBe(0);
    expect(stored.stock).toBe(4);
  });

  it('notifies the seller about a new demo request', async () => {
    const { seller, store, product } = await shopWithProduct();
    const s = await socketAs(seller);
    const note = nextEvent(s, 'notify');
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina Wanjiru');
    await request(app).post(`/api/stores/${store.id}/presentation-requests`).set('Cookie', buyer).send({ product: product.id, message: 'Do you have XL?' });
    expect(await note).toMatchObject({ type: 'demo_request', title: 'New demo request', link: '/seller/requests' });
    expect((await request(app).get('/api/auth/badges').set('Cookie', seller)).body.data.badges).toMatchObject({ requests: 1 });

    // When the shop goes live, the shopper who asked hears about it wherever they are on the site.
    const b = await socketAs(buyer);
    const live = nextEvent(b, 'notify');
    await request(app).post('/api/rooms/start').set('Cookie', seller);
    expect(await live).toMatchObject({ type: 'shop_live', title: 'Grace Fashion is live now', link: '/shop/grace-fashion/live', action: 'Walk in' });
  });

  it('lets the seller invite a demo requester into the live room, even one who was offline', async () => {
    const { seller, store, product } = await shopWithProduct();
    const buyer = await loginAs('buyer', 'amina@example.com', 'Amina Wanjiru');
    const reqRes = await request(app).post(`/api/stores/${store.id}/presentation-requests`).set('Cookie', buyer).send({ product: product.id });
    const requestId = reqRes.body.data.request.id;

    // Not live yet → go live first.
    const early = await request(app).post(`/api/stores/mine/presentation-requests/${requestId}/invite`).set('Cookie', seller);
    expect(early.status).toBe(409);

    await request(app).post('/api/rooms/start').set('Cookie', seller);
    const b = await socketAs(buyer);
    const invite = nextEvent(b, 'notify');
    const res = await request(app).post(`/api/stores/mine/presentation-requests/${requestId}/invite`).set('Cookie', seller);
    expect(res.status).toBe(200);
    expect(res.body.data.request).toMatchObject({ status: 'seen' });
    expect(await invite).toMatchObject({
      type: 'demo_invite',
      title: 'Grace Fashion is ready to show you the Khaki shirt',
      link: `/shop/grace-fashion/live?ask=${product.id}`,
      action: 'Join the demo',
      sticky: true,
    });

    // The shopper opens Meet2buy later: the invite is handed over on sync.
    const later = await socketAs(buyer);
    const again = nextEvent(later, 'notify');
    later.emit('notify:sync');
    expect((await again).type).toBe('demo_invite');

    // Active requests (open + seen) for Live control.
    const active = await request(app).get('/api/stores/mine/presentation-requests?status=active').set('Cookie', seller);
    expect(active.body.data.requests).toHaveLength(1);
  });
});
