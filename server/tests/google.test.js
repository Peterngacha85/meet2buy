import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Stand-in for Google's token check: the "credential" is a JSON string of the payload we want.
vi.mock('../src/services/google.js', () => ({
  isGoogleConfigured: () => true,
  verifyGoogleIdToken: vi.fn(async (token) => {
    try {
      return JSON.parse(token);
    } catch {
      return null;
    }
  }),
}));

const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const app = createApp();

const cred = (over = {}) =>
  JSON.stringify({
    sub: 'google-123',
    email: 'wanjiku@gmail.com',
    emailVerified: true,
    name: 'Wanjiku Kamau',
    picture: 'https://lh3.googleusercontent.com/a/x',
    pad: 'xxxxxxxxxxxxxxxxxxxx',
    ...over,
  });

const google = (over) => request(app).post('/api/auth/google').send({ credential: cred(over) });

describe('POST /api/auth/google', () => {
  beforeEach(() => vi.clearAllMocks());

  it('signs up a new buyer without phone or password and sets the cookie', async () => {
    const res = await google();
    expect(res.status).toBe(201);
    expect(res.body.data.isNew).toBe(true);
    expect(res.body.data.user).toMatchObject({ email: 'wanjiku@gmail.com', role: 'buyer', name: 'Wanjiku Kamau' });
    expect(res.body.data.user.googleId).toBeUndefined();
    expect(res.headers['set-cookie'].join()).toMatch(/m2b_token=/);

    const again = await google();
    expect(again.status).toBe(200);
    expect(again.body.data.isNew).toBe(false);
    expect(await User.countDocuments()).toBe(1);
  });

  it('links Google to an existing account with the same verified email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Wanjiku', email: 'wanjiku@gmail.com', phone: '0712345678', password: 'supersecret1' });
    const res = await google();
    expect(res.status).toBe(200);
    const stored = await User.findOne({ email: 'wanjiku@gmail.com' });
    expect(stored.googleId).toBe('google-123');
    expect(stored.phone).toBe('254712345678');
  });

  it('rejects unverified emails, invalid tokens and admin accounts', async () => {
    expect((await google({ emailVerified: false })).status).toBe(401);
    expect((await request(app).post('/api/auth/google').send({ credential: 'not-a-valid-google-token-x' })).status).toBe(401);

    await User.create({ name: 'Boss', email: 'boss@gmail.com', password: 'supersecret1', role: 'admin' });
    expect((await google({ sub: 'g-admin', email: 'boss@gmail.com' })).status).toBe(403);
  });

  it('a Google-only account cannot log in with a password but can set one', async () => {
    const res = await google();
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('m2b_token='));
    expect((await request(app).post('/api/auth/login').send({ email: 'wanjiku@gmail.com', password: 'anything12' })).status).toBe(401);

    const set = await request(app).patch('/api/auth/me').set('Cookie', cookie).send({ newPassword: 'mynewpassword1' });
    expect(set.status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: 'wanjiku@gmail.com', password: 'mynewpassword1' })).status).toBe(200);
  });
});

describe('GET /api/auth/config', () => {
  it('tells the client which Google client id to use', async () => {
    const res = await request(app).get('/api/auth/config');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('googleClientId');
  });
});
