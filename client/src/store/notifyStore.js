import { create } from 'zustand';
import { api, unwrap } from '../services/api.js';

let nextId = 1;

/** Toasts on screen and the sidebar badge counts (demo requests, orders to ship, shops to review). */
export const useNotifyStore = create((set) => ({
  toasts: [],
  badges: {},

  push(toast) {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, ...toast }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  async refreshBadges() {
    try {
      const { badges } = await unwrap(api.get('/auth/badges'));
      set({ badges });
    } catch {
      /* logged out or offline: keep the old counts */
    }
  },
  clear: () => set({ toasts: [], badges: {} }),
}));

/** A short two-note chime (no audio file needed). Browsers may block it until the user has clicked the page. */
export function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch {
    /* sound is a nice-to-have */
  }
}

/** System notification when the tab is in the background (only if the user allowed it). */
export function systemNotify(title, body) {
  try {
    if (document.visibilityState === 'visible') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification(title, { body, icon: '/favicon-192.png', tag: 'meet2buy' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* not supported */
  }
}

/** Ask once, at a moment that makes sense (e.g. joining the queue). */
export function askNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  } catch {
    /* not supported */
  }
}

/** Flash the tab title until the page is looked at. */
export function flashTitle(text) {
  if (document.visibilityState === 'visible') return;
  const original = document.title;
  let on = false;
  const t = setInterval(() => {
    document.title = on ? original : text;
    on = !on;
  }, 1000);
  const stop = () => {
    if (document.visibilityState !== 'visible') return;
    clearInterval(t);
    document.title = original;
    document.removeEventListener('visibilitychange', stop);
  };
  document.addEventListener('visibilitychange', stop);
}
