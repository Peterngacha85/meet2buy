import { isProd } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.statusCode ?? 500;
  let message = err.message;
  let errors = err.errors;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'value';
    message = `That ${field} is already in use`;
    errors = [{ field, message }];
  } else if (err.name === 'ValidationError') {
    status = 400;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = errors[0]?.message ?? 'Invalid data';
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  }

  if (status >= 500) {
    logger.error(req.method, req.originalUrl, err);
    if (isProd) message = 'Something went wrong. Please try again.';
  }

  res.status(status).json({ success: false, message, ...(errors ? { errors } : {}) });
}
