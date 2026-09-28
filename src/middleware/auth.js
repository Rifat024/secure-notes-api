import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, ROLES } from '../models/User.js';
import { HttpError } from '../utils/httpError.js';

export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  });

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentication required');

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw new HttpError(401, 'Invalid or expired token');
    }

    // Role is re-read from the database so demotions and deletions take effect immediately.
    const user = await User.findById(payload.sub, { role: 1, name: 1, email: 1 }).lean();
    if (!user) throw new HttpError(401, 'Account no longer exists');

    req.user = { id: user._id.toString(), role: user.role, name: user.name, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

export const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'Insufficient permissions'));

export const requireAdmin = authorize(ROLES.ADMIN);
