import { create } from 'zustand';
import { api, unwrap } from '../services/api.js';

export const homeForRole = (role) => (role === 'admin' ? '/admin' : role === 'seller' ? '/seller' : '/');

export const useAuthStore = create((set) => ({
  user: null,
  // The seller's own shop (null for buyers and admins).
  store: null,
  // 'loading' until the first /auth/me check finishes, so guards don't redirect too early.
  status: 'loading',

  async init() {
    try {
      const { user, store } = await unwrap(api.get('/auth/me'));
      set({ user, store, status: 'ready' });
    } catch {
      set({ user: null, store: null, status: 'ready' });
    }
  },

  async login(credentials) {
    await unwrap(api.post('/auth/login', credentials));
    const { user, store } = await unwrap(api.get('/auth/me'));
    set({ user, store, status: 'ready' });
    return user;
  },

  async register(data) {
    const { user } = await unwrap(api.post('/auth/register', data));
    set({ user, store: null, status: 'ready' });
    return user;
  },

  async loginWithGoogle(credential) {
    await unwrap(api.post('/auth/google', { credential }));
    const { user, store } = await unwrap(api.get('/auth/me'));
    set({ user, store, status: 'ready' });
    return user;
  },

  async registerSeller(data) {
    const { user, store } = await unwrap(api.post('/auth/register-seller', data));
    set({ user, store, status: 'ready' });
    return user;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      set({ user: null, store: null, status: 'ready' });
    }
  },

  setUser: (user) => set({ user }),
  setStore: (store) => set({ store }),
}));
