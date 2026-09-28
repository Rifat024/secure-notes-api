import mongoose from 'mongoose';
import { HttpError } from '../utils/httpError.js';

export const notFoundHandler = (req, _res, next) => next(new HttpError(404, `Route ${req.method} ${req.path} not found`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    if (err.headers) res.set(err.headers);
    return res.status(err.status).json({ error: err.message, ...(err.details && { details: err.details }) });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'Email is already registered' });
  }
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
