import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30_000,
    hookTimeout: 120_000, // first run downloads a MongoDB binary
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      BCRYPT_ROUNDS: '4',
      CLIENT_URL: 'http://localhost:5173',
      CLOUDINARY_CLOUD_NAME: 'testcloud',
      CLOUDINARY_API_KEY: '123456789012345',
      CLOUDINARY_API_SECRET: 'test-cloudinary-secret',
      LIVEKIT_URL: 'wss://test.livekit.cloud',
      LIVEKIT_API_KEY: 'APItestkey',
      LIVEKIT_API_SECRET: 'test-livekit-secret-that-is-long-enough',
      SELLER_GRACE_SECONDS: '1',
      MPESA_CALLBACK_TOKEN: 'test-callback-token',
      API_PUBLIC_URL: 'https://api.test',
    },
  },
});
