import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { ensureAdminFromEnv } from '../src/services/adminBootstrap.js';

const app = createApp();
const cfg = { email: 'Owner@Meet2buy.co.ke', password: 'a-very-long-password', name: 'Owner' };

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('ensureAdminFromEnv', () => {
  it('does nothing when email/password are missing', async () => {
    expect(await ensureAdminFromEnv({})).toBeNull();
    expect(await User.countDocuments()).toBe(0);
  });

  it('creates an admin without a phone who can log in', async () => {
    await ensureAdminFromEnv(cfg);
    const res = await login('owner@meet2buy.co.ke', cfg.password);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ role: 'admin', email: 'owner@meet2buy.co.ke' });
  });

  it('is idempotent across restarts', async () => {
    await ensureAdminFromEnv(cfg);
    await ensureAdminFromEnv(cfg);
    expect(await User.countDocuments({ role: 'admin' })).toBe(1);
  });

  it('syncs a changed password', async () => {
    await ensureAdminFromEnv(cfg);
    await ensureAdminFromEnv({ ...cfg, password: 'a-brand-new-password' });
    expect((await login(cfg.email, cfg.password)).status).toBe(401);
    expect((await login(cfg.email, 'a-brand-new-password')).status).toBe(200);
  });

  it('promotes and reactivates an existing account with that email', async () => {
    await User.create({
      name: 'Owner',
      email: 'owner@meet2buy.co.ke',
      phone: '254712345678',
      password: 'oldpassword1',
      role: 'buyer',
      status: 'suspended',
    });
    await ensureAdminFromEnv(cfg);
    const user = await User.findOne({ email: 'owner@meet2buy.co.ke' });
    expect(user).toMatchObject({ role: 'admin', status: 'active' });
  });

  it('disables the previous admin when ADMIN_EMAIL changes', async () => {
    await ensureAdminFromEnv(cfg);
    const oldSession = (await login(cfg.email, cfg.password)).headers['set-cookie'][0];

    const next = { email: 'new-owner@meet2buy.co.ke', password: 'another-long-password' };
    await ensureAdminFromEnv(next);

    const oldLogin = await login(cfg.email, cfg.password);
    expect(oldLogin.status).toBe(401);
    expect(oldLogin.body.message).toBe('Incorrect email or password');
    expect((await request(app).get('/api/auth/me').set('Cookie', oldSession)).status).toBe(401);

    expect((await login(next.email, next.password)).status).toBe(200);
    expect(await User.countDocuments({ isEnvOwner: true })).toBe(1);
  });

  it('switching back to an old email re-enables that account', async () => {
    await ensureAdminFromEnv(cfg);
    await ensureAdminFromEnv({ email: 'new-owner@meet2buy.co.ke', password: 'another-long-password' });
    await ensureAdminFromEnv(cfg);
    expect((await login(cfg.email, cfg.password)).status).toBe(200);
    expect((await login('new-owner@meet2buy.co.ke', 'another-long-password')).status).toBe(401);
  });

  it('keeps the current owner if the ADMIN_* variables are removed', async () => {
    await ensureAdminFromEnv(cfg);
    await ensureAdminFromEnv({});
    expect((await login(cfg.email, cfg.password)).status).toBe(200);
  });

  it('does not touch admins added from the dashboard', async () => {
    await User.create({
      name: 'Helper',
      email: 'helper@meet2buy.co.ke',
      phone: '254712345678',
      password: 'helperpass12',
      role: 'admin',
    });
    await ensureAdminFromEnv(cfg);
    await ensureAdminFromEnv({ email: 'new-owner@meet2buy.co.ke', password: 'another-long-password' });
    expect((await login('helper@meet2buy.co.ke', 'helperpass12')).status).toBe(200);
  });

  it('ignores an invalid phone instead of failing startup', async () => {
    const user = await ensureAdminFromEnv({ ...cfg, phone: '12345' });
    expect(user.phone).toBeUndefined();
  });
});
