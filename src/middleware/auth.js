import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { security } from '../config/security.js';
import { User, ROLES } from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import { clientIp } from '../utils/clientIp.js';
import { securityLog } from '../utils/securityLog.js';

const JWT_OPTIONS = { algorithm: 'HS256', issuer: security.jwtIssuer, audience: security.jwtAudience };

export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role, tv: user.tokenVersion ?? 0 }, env.jwtSecret, {
    ...JWT_OPTIONS,
    expiresIn: env.jwtExpiresIn,
  });

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentication required');

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret, {
        algorithms: [JWT_OPTIONS.algorithm],
        issuer: JWT_OPTIONS.issuer,
        audience: JWT_OPTIONS.audience,
      });
    } catch {
      throw new HttpError(401, 'Invalid or expired token');
    }

    // Role and token version are re-read so demotion, deletion, and logout take effect immediately.
    const user = await User.findById(payload.sub, { role: 1, name: 1, email: 1, tokenVersion: 1 }).lean();
    if (!user) throw new HttpError(401, 'Account no longer exists');
    if ((user.tokenVersion ?? 0) !== (payload.tv ?? 0)) throw new HttpError(401, 'Session has been revoked');

    req.user = { id: user._id.toString(), role: user.role, name: user.name, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

export const authorize = (...roles) => (req, _res, next) => {
  if (roles.includes(req.user?.role)) return next();
  securityLog('forbidden', { userId: req.user?.id, ip: clientIp(req), path: req.originalUrl });
  return next(new HttpError(403, 'Insufficient permissions'));
};

export const requireAdmin = authorize(ROLES.ADMIN);
