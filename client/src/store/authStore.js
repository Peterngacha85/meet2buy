import { create } from 'zustand';
import { api, unwrap } from '../services/api.js';

export const homeForRole = (role) => (role === 'admin' ? '/admin' : role === 'seller' ? '/seller' : '/');

export const useAuthStore = create((set) => ({
  user: null,
  // 'loading' until the first /auth/me check finishes, so guards don't redirect too early.
  status: 'loading',

  async init() {
    try {
      const { user } = await unwrap(api.get('/auth/me'));
      set({ user, status: 'ready' });
    } catch {
      set({ user: null, status: 'ready' });
    }
  },

  async login(credentials) {
    const { user } = await unwrap(api.post('/auth/login', credentials));
    set({ user, status: 'ready' });
    return user;
  },

  async register(data) {
    const { user } = await unwrap(api.post('/auth/register', data));
    set({ user, status: 'ready' });
    return user;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      set({ user: null, status: 'ready' });
    }
  },

  setUser: (user) => set({ user }),
}));
