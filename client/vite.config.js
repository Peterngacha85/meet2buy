import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development the API and Socket.io are proxied, so the auth cookie is same-origin.
// API_PROXY overrides the target, e.g. API_PROXY=http://localhost:5055
const api = process.env.API_PROXY ?? 'http://localhost:5000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': api,
      '/socket.io': { target: api, ws: true },
    },
  },
});
