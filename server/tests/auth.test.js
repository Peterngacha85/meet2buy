import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';

const app = createApp();

const buyer = {
  name: 'Jane Wanjiku',
  email: 'Jane@Example.com',
  phone: '0712 345 678',
  password: 'supersecret1',
};

const cookieFrom = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('m2b_token='));

async function registerAndGetCookie(body = buyer) {
  const res = await request(app).post('/api/auth/register').send(body);
  return { res, cookie: cookieFrom(res) };
}

describe('POST /api/auth/register', () => {
  it('creates a buyer, normalises email and phone, sets an httpOnly cookie', async () => {
    const { res, cookie } = await registerAndGetCookie();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      name: 'Jane Wanjiku',
      email: 'jane@example.com',
      phone: '254712345678',
      role: 'buyer',
      status: 'active',
    });
    expect(res.body.data.user.password).toBeUndefined();
    expect(cookie).toMatch(/HttpOnly/i);

    const stored = await User.findOne({ email: 'jane@example.com' }).select('+password');
    expect(stored.password).not.toBe(buyer.password);
  });

  it('ignores a role sent by the client', async () => {
    const { res } = await registerAndGetCookie({ ...buyer, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('buyer');
  });

  it('rejects a duplicate email with 409', async () => {
    await registerAndGetCookie();
    const { res } = await registerAndGetCookie({ ...buyer, email: 'jane@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid input with field errors', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'J', email: 'nope', phone: '123', password: 'short' });
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'phone', 'password']));
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials (email case-insensitive)', async () => {
    await registerAndGetCookie();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'JANE@example.com', password: buyer.password });
    expect(res.status).toBe(200);
    expect(cookieFrom(res)).toBeDefined();
  });

  it('rejects a wrong password with 401 and a generic message', async () => {
    await registerAndGetCookie();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: buyer.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Incorrect email or password');
  });

  it('rejects suspended users with 403', async () => {
    await registerAndGetCookie();
    await User.updateOne({ email: 'jane@example.com' }, { status: 'suspended' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: buyer.email, password: buyer.password });
    expect(res.status).toBe(403);
  });
});

describe('GET/PATCH /api/auth/me', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user with a cookie', async () => {
    const { cookie } = await registerAndGetCookie();
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('jane@example.com');
  });

  it('locks out a user suspended after logging in', async () => {
    const { cookie } = await registerAndGetCookie();
    await User.updateOne({ email: 'jane@example.com' }, { status: 'suspended' });
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });

  it('updates name and phone', async () => {
    const { cookie } = await registerAndGetCookie();
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ name: 'Jane W.', phone: '+254 110 000 000' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ name: 'Jane W.', phone: '254110000000' });
  });

  it('requires the current password to change the password', async () => {
    const { cookie } = await registerAndGetCookie();

    const missing = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ newPassword: 'brandnewpass1' });
    expect(missing.status).toBe(400);

    const wrong = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ currentPassword: 'nottheone', newPassword: 'brandnewpass1' });
    expect(wrong.status).toBe(400);

    const right = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ currentPassword: buyer.password, newPassword: 'brandnewpass1' });
    expect(right.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: buyer.email, password: 'brandnewpass1' });
    expect(login.status).toBe(200);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(cookieFrom(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('misc', () => {
  it('health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('unknown routes return 404 in the standard format', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('malformed JSON returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
  });
});
