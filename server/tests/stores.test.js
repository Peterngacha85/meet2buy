import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Store } from '../src/models/Store.js';
import { signParams } from '../src/services/cloudinary.js';

const app = createApp();
const IMG = 'https://res.cloudinary.com/testcloud/image/upload/v1/meet2buy/products/a.jpg';

const cookieFrom = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('m2b_token='));

const sellerBody = (over = {}) => ({
  account: { name: 'Grace Achieng', email: 'grace@hisense.test', phone: '0722 000 111', password: 'supersecret1' },
  store: {
    name: 'Hisense',
    description: 'TVs, fridges and more',
    departments: [
      { name: 'TVs', wing: 'home-appliances' },
      { name: 'Fridges', wing: 'home-appliances' },
    ],
  },
  payout: { type: 'till', tillNumber: '123 456', registeredName: 'HISENSE KENYA' },
  ...over,
});

async function registerSeller(body = sellerBody()) {
  const res = await request(app).post('/api/auth/register-seller').send(body);
  return { res, cookie: cookieFrom(res) };
}

async function loginAs(role, email) {
  await User.create({ name: `${role} user`, email, phone: '254733000222', password: 'supersecret1', role });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'supersecret1' });
  return cookieFrom(res);
}

async function approvedShop() {
  const { res, cookie } = await registerSeller();
  const admin = await loginAs('admin', 'boss@meet2buy.test');
  await request(app).patch(`/api/admin/sellers/${res.body.data.store.id}/approve`).set('Cookie', admin);
  return { cookie, admin, store: res.body.data.store };
}

describe('POST /api/auth/register-seller', () => {
  it('creates a seller with a pending shop, departments and private payout details', async () => {
    const { res, cookie } = await registerSeller();

    expect(res.status).toBe(201);
    expect(cookie).toBeTruthy();
    expect(res.body.data.user.role).toBe('seller');
    expect(res.body.data.store).toMatchObject({
      name: 'Hisense',
      slug: 'hisense',
      status: 'pending',
      wings: ['home-appliances'],
      payout: { type: 'till', tillNumber: '123456', verified: false },
    });
    expect(res.body.data.store.departments.map((d) => d.slug)).toEqual(['tvs', 'fridges']);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.data.store.name).toBe('Hisense');
  });

  it('gives a second shop with the same name a unique slug', async () => {
    await registerSeller();
    const { res } = await registerSeller(
      sellerBody({ account: { name: 'Other', email: 'other@x.test', phone: '0711999888', password: 'supersecret1' } }),
    );
    expect(res.body.data.store.slug).toBe('hisense-2');
  });

  it('rejects an unknown wing and leaves no half-created account', async () => {
    const body = sellerBody();
    body.store.departments = [{ name: 'Shoes', wing: 'no-such-wing' }];
    const { res } = await registerSeller(body);
    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  it('validates payout details', async () => {
    const { res } = await registerSeller(sellerBody({ payout: { type: 'paybill', paybillNumber: '12', registeredName: 'X Y' } }));
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toContain('payout.paybillNumber');
    expect(fields).toContain('payout.accountNumber');
  });

  it('refuses an email that is already registered', async () => {
    await registerSeller();
    const { res } = await registerSeller();
    expect(res.status).toBe(409);
    expect(res.body.errors[0].field).toBe('account.email');
  });
});

describe('mall directory', () => {
  it('only shows approved shops, never with payout details', async () => {
    const { res } = await registerSeller();
    const storeId = res.body.data.store.id;

    let list = await request(app).get('/api/stores');
    expect(list.body.data.total).toBe(0);
    expect((await request(app).get('/api/stores/hisense')).status).toBe(404);

    const admin = await loginAs('admin', 'boss@meet2buy.test');
    const approved = await request(app).patch(`/api/admin/sellers/${storeId}/approve`).set('Cookie', admin);
    expect(approved.body.data.seller.payout.verified).toBe(true);

    list = await request(app).get('/api/stores?wing=home-appliances');
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.stores[0].payout).toBeUndefined();
    expect((await request(app).get('/api/stores?wing=phones-and-tablets')).body.data.total).toBe(0);
    expect((await request(app).get('/api/stores?q=hise')).body.data.total).toBe(1);

    const wings = await request(app).get('/api/stores/wings');
    expect(wings.body.data.totals.shops).toBe(1);
    expect(wings.body.data.wings.find((w) => w.slug === 'home-appliances').shopCount).toBe(1);

    const page = await request(app).get('/api/stores/hisense');
    expect(page.status).toBe(200);
    expect(page.body.data.store.payout).toBeUndefined();
    expect(page.body.data.store.status).toBeUndefined();
  });

  it('lets the owner preview their shop before approval', async () => {
    const { cookie } = await registerSeller();
    const res = await request(app).get('/api/stores/hisense').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.preview).toBe('pending');
  });

  it('removes a suspended shop from the mall and brings it back on reinstate', async () => {
    const { admin, store } = await approvedShop();
    await request(app).patch(`/api/admin/sellers/${store.id}/suspend`).set('Cookie', admin).send({ reason: 'Complaints' });
    expect((await request(app).get('/api/stores')).body.data.total).toBe(0);
    await request(app).patch(`/api/admin/sellers/${store.id}/reinstate`).set('Cookie', admin);
    expect((await request(app).get('/api/stores')).body.data.total).toBe(1);
  });

  it('lets a rejected seller resubmit', async () => {
    const { res, cookie } = await registerSeller();
    const admin = await loginAs('admin', 'boss@meet2buy.test');
    const rejected = await request(app)
      .patch(`/api/admin/sellers/${res.body.data.store.id}/reject`)
      .set('Cookie', admin)
      .send({ reason: 'Upload your logo' });
    expect(rejected.body.data.seller).toMatchObject({ status: 'rejected', rejectionReason: 'Upload your logo' });

    const again = await request(app).post('/api/stores/mine/resubmit').set('Cookie', cookie);
    expect(again.body.data.store.status).toBe('pending');
  });

  it('keeps admin endpoints away from sellers and buyers', async () => {
    const { cookie } = await registerSeller();
    expect((await request(app).get('/api/admin/sellers').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).get('/api/admin/sellers')).status).toBe(401);
  });
});

describe('shop profile', () => {
  it('updates signage and keeps department ids when renaming', async () => {
    const { cookie, res } = await registerSeller();
    const tvs = res.body.data.store.departments[0];

    const upd = await request(app)
      .patch('/api/stores/mine')
      .set('Cookie', cookie)
      .send({
        logo: 'https://res.cloudinary.com/testcloud/image/upload/v1/meet2buy/logos/h.png',
        brandColor: '#00A9A5',
        departments: [
          { id: tvs.id, name: 'Televisions', wing: 'home-appliances' },
          { name: 'Cookers', wing: 'home-appliances' },
        ],
      });
    expect(upd.status).toBe(200);
    expect(upd.body.data.store.brandColor).toBe('#00A9A5');
    expect(upd.body.data.store.departments[0]).toMatchObject({ id: tvs.id, name: 'Televisions', slug: 'televisions' });
    expect(upd.body.data.store.departments.map((d) => d.name)).toEqual(['Televisions', 'Cookers']);
  });

  it('rejects image URLs that are not from our Cloudinary account', async () => {
    const { cookie } = await registerSeller();
    const res = await request(app).patch('/api/stores/mine').set('Cookie', cookie).send({ logo: 'https://evil.test/x.png' });
    expect(res.status).toBe(400);
  });

  it('will not remove a department that still has products', async () => {
    const { cookie, res } = await registerSeller();
    const [tvs, fridges] = res.body.data.store.departments;
    await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: '55" Smart TV', department: tvs.id, price: 54999, stock: 4 });

    const blocked = await request(app)
      .patch('/api/stores/mine')
      .set('Cookie', cookie)
      .send({ departments: [{ id: fridges.id, name: 'Fridges', wing: 'home-appliances' }] });
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/TVs/);
  });

  it('resets payout verification when payout details change', async () => {
    const { cookie } = await approvedShop();
    const res = await request(app)
      .patch('/api/stores/mine/payout')
      .set('Cookie', cookie)
      .send({ type: 'paybill', paybillNumber: '522522', accountNumber: 'HISENSE', registeredName: 'HISENSE KENYA' });
    expect(res.body.data.store.payout).toMatchObject({ type: 'paybill', verified: false });
    expect(res.body.data.store.payout.tillNumber).toBeUndefined();
  });
});

describe('products', () => {
  it('creates products in a department and shows only visible ones in the shop', async () => {
    const { cookie, store } = await approvedShop();
    const tvs = store.departments[0];

    const created = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: '55" Smart TV', department: tvs.id, price: '54999', stock: 4, images: [IMG] });
    expect(created.status).toBe(201);
    expect(created.body.data.product).toMatchObject({ price: 54999, department: tvs.id });

    await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'Old model', department: tvs.id, price: 1000, stock: 1, isVisible: false });

    const page = await request(app).get('/api/stores/hisense');
    expect(page.body.data.products.map((p) => p.name)).toEqual(['55" Smart TV']);
    expect((await request(app).get('/api/products/mine').set('Cookie', cookie)).body.data.products).toHaveLength(2);
  });

  it('rejects a department from another shop and bad prices', async () => {
    const { cookie } = await approvedShop();
    const other = await Store.findOne();
    const bad = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'TV', department: '507f1f77bcf86cd799439011', price: 10, stock: 1 });
    expect(bad.status).toBe(400);
    const price = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'TV', department: other.departments[0]._id.toString(), price: 10.5, stock: 1 });
    expect(price.status).toBe(400);
  });

  it("does not let a seller edit or delete another seller's product", async () => {
    const { cookie, store } = await approvedShop();
    const created = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .send({ name: 'TV', department: store.departments[0].id, price: 1000, stock: 1 });
    const id = created.body.data.product.id;

    const { cookie: other } = await registerSeller(
      sellerBody({ account: { name: 'Other', email: 'other@x.test', phone: '0711999888', password: 'supersecret1' } }),
    );
    expect((await request(app).patch(`/api/products/${id}`).set('Cookie', other).send({ price: 1 })).status).toBe(404);
    expect((await request(app).delete(`/api/products/${id}`).set('Cookie', other)).status).toBe(404);
    expect((await request(app).delete(`/api/products/${id}`).set('Cookie', cookie)).status).toBe(200);
  });
});

describe('demo requests (presentation requests)', () => {
  it('lets a buyer ask for a demo and the seller see it with no contact details', async () => {
    const { cookie: sellerCookie, store } = await approvedShop();
    const product = (
      await request(app)
        .post('/api/products')
        .set('Cookie', sellerCookie)
        .send({ name: 'Fridge 300L', department: store.departments[1].id, price: 45000, stock: 2 })
    ).body.data.product;

    const buyer = await loginAs('buyer', 'jane@x.test');
    expect((await request(app).post(`/api/stores/${store.id}/presentation-requests`).send({})).status).toBe(401);

    const first = await request(app)
      .post(`/api/stores/${store.id}/presentation-requests`)
      .set('Cookie', buyer)
      .send({ product: product.id, message: 'Does it have a water dispenser?' });
    expect(first.status).toBe(201);
    const again = await request(app)
      .post(`/api/stores/${store.id}/presentation-requests`)
      .set('Cookie', buyer)
      .send({ product: product.id });
    expect(again.status).toBe(200); // same open request, not a duplicate

    const list = await request(app).get('/api/stores/mine/presentation-requests').set('Cookie', sellerCookie);
    expect(list.body.data.openCount).toBe(1);
    const [req0] = list.body.data.requests;
    expect(req0).toMatchObject({ departmentName: 'Fridges', message: 'Does it have a water dispenser?' });
    expect(req0.buyer).toEqual({ id: expect.any(String), name: 'buyer user' });

    const seen = await request(app)
      .patch(`/api/stores/mine/presentation-requests/${req0.id}`)
      .set('Cookie', sellerCookie)
      .send({ status: 'seen' });
    expect(seen.body.data.request.status).toBe('seen');
  });
});

describe('POST /api/uploads/signature', () => {
  it('signs a direct Cloudinary upload for sellers only', async () => {
    const { cookie } = await registerSeller();
    const res = await request(app).post('/api/uploads/signature').set('Cookie', cookie).send({ kind: 'logo' });
    expect(res.status).toBe(200);
    const { params, signature, apiKey, uploadUrl } = res.body.data;
    expect(uploadUrl).toBe('https://api.cloudinary.com/v1_1/testcloud/image/upload');
    expect(apiKey).toBe('123456789012345');
    expect(params.folder).toBe('meet2buy/logos');
    expect(signature).toBe(signParams(params, 'test-cloudinary-secret'));
    expect(JSON.stringify(res.body)).not.toContain('test-cloudinary-secret');

    const buyer = await loginAs('buyer', 'jane@x.test');
    expect((await request(app).post('/api/uploads/signature').set('Cookie', buyer).send({ kind: 'logo' })).status).toBe(403);
  });
});
