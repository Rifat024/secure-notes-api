import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../../src/config/env.js';
import { signToken, authorize, requireAdmin } from '../../src/middleware/auth.js';
import { validate } from '../../src/middleware/validate.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { HttpError } from '../../src/utils/httpError.js';

const mockRes = () => {
  const res = {};
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
};

describe('signToken', () => {
  test('issues an HS256 token carrying the user id and role', () => {
    const id = new mongoose.Types.ObjectId();
    const token = signToken({ _id: id, role: 'admin' });
    const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: 'secure-notes-api', audience: 'secure-notes-web' });
    expect(decoded).toMatchObject({ sub: id.toString(), role: 'admin', tv: 0 });
    expect(jwt.decode(token, { complete: true }).header.alg).toBe('HS256');
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });
});

describe('authorize', () => {
  test('allows a permitted role', () => {
    const next = jest.fn();
    requireAdmin({ user: { role: 'admin' } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  test.each([{ user: { role: 'user' } }, {}])('rejects %o with 403', (req) => {
    const next = jest.fn();
    authorize('admin')(req, {}, next);
    const [err] = next.mock.calls[0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
  });
});

describe('validate', () => {
  const schemas = { body: z.object({ title: z.string().trim().min(1) }).strict() };

  test('stores parsed values on req.valid and calls next', () => {
    const req = { body: { title: '  Hello ' } };
    const next = jest.fn();
    validate(schemas)(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.valid.body).toEqual({ title: 'Hello' });
  });

  test('passes a 400 with field details on failure', () => {
    const next = jest.fn();
    validate(schemas)({ body: { title: '' } }, {}, next);
    const [err] = next.mock.calls[0];
    expect(err.status).toBe(400);
    expect(err.details[0]).toMatchObject({ path: 'title' });
  });
});

describe('errorHandler', () => {
  test('renders HttpError with its status and details', () => {
    const res = mockRes();
    errorHandler(new HttpError(404, 'Note not found'), {}, res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Note not found' });
  });

  test('maps duplicate key errors to 409', () => {
    const res = mockRes();
    errorHandler({ code: 11000 }, {}, res, () => {});
    expect(res.statusCode).toBe(409);
  });

  test('maps malformed JSON to 400', () => {
    const res = mockRes();
    errorHandler({ type: 'entity.parse.failed' }, {}, res, () => {});
    expect(res.statusCode).toBe(400);
  });

  test('hides internal error details behind a generic 500', () => {
    const res = mockRes();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('connection string leaked'), {}, res, () => {});
    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});
