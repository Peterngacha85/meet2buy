import { isTest } from '../config/env.js';

// Minimal logger. Silent in tests. Swap for pino later if needed.
const write = (level, args) => {
  if (isTest) return;
  const line = [`[${new Date().toISOString()}] ${level.toUpperCase()}`, ...args];
  (level === 'error' ? console.error : console.log)(...line);
};

export const logger = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
};
