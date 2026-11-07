import { AppError } from '../utils/AppError.js';

/**
 * Validate req[source] against a zod schema and replace it with the parsed
 * (trimmed, normalised, unknown-keys-stripped) value.
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      throw new AppError(400, errors[0]?.message ?? 'Invalid request', errors);
    }
    if (source === 'body') req.body = result.data;
    else req.validated = { ...req.validated, [source]: result.data };
    next();
  };
