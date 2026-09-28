import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { security } from '../config/security.js';
import { clientIp } from '../utils/clientIp.js';
import { securityLog } from '../utils/securityLog.js';

/**
 * Per-instance limits that absorb bursts before they reach the database. Failed sign-ins are
 * additionally tracked in MongoDB (see services/loginGuard.js) so lockouts hold across instances.
 */
const limiter = ({ windowMs, limit }, message, event) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
    skip: () => process.env.NODE_ENV === 'test',
    handler: (req, res, _next, options) => {
      securityLog(event, { ip: clientIp(req), path: req.originalUrl });
      res.status(options.statusCode).json({ error: message });
    },
  });

export const apiLimiter = limiter(security.apiRateLimit, 'Too many requests, please slow down', 'rate_limited');
export const authLimiter = limiter(security.authRateLimit, 'Too many sign-in attempts, please try again later', 'auth_rate_limited');
export const registerLimiter = limiter(security.registerRateLimit, 'Too many accounts created from this network, please try again later', 'register_rate_limited');
