import { security } from '../config/security.js';
import { LoginThrottle } from '../models/LoginThrottle.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import { securityLog } from '../utils/securityLog.js';

const LOCKED_MESSAGE = 'Too many failed sign-in attempts. Please try again later.';

export function lockedError(until) {
  const retryAfter = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
  return new HttpError(429, LOCKED_MESSAGE, undefined, { 'Retry-After': String(retryAfter) });
}

export async function assertIpAllowed(ip) {
  const record = await LoginThrottle.findById(ip, { blockedUntil: 1 }).lean();
  if (record?.blockedUntil && record.blockedUntil > new Date()) throw lockedError(record.blockedUntil);
}

/** Counts a failure inside a sliding window and blocks the IP once the limit is reached, atomically. */
export async function recordIpFailure(ip) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - security.ipWindowMs);
  const inWindow = { $gt: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, windowStart] };

  const record = await LoginThrottle.findOneAndUpdate(
    { _id: ip },
    [
      {
        $set: {
          failures: { $cond: [inWindow, { $add: [{ $ifNull: ['$failures', 0] }, 1] }, 1] },
          windowStartedAt: { $cond: [inWindow, '$windowStartedAt', now] },
        },
      },
      {
        $set: {
          blockedUntil: {
            $cond: [
              { $gte: ['$failures', security.ipMaxFailures] },
              new Date(now.getTime() + security.ipBlockMs),
              '$blockedUntil',
            ],
          },
        },
      },
    ],
    { upsert: true, new: true, lean: true },
  );

  if (record.failures === security.ipMaxFailures) {
    securityLog('ip_blocked', { ip, until: record.blockedUntil });
  }
}

/** Increments the account's failure count and locks it when the limit is reached, atomically. */
export async function recordAccountFailure(userId) {
  const now = new Date();
  const reachesLimit = { $gte: [{ $add: [{ $ifNull: ['$failedLoginAttempts', 0] }, 1] }, security.accountMaxFailures] };

  const user = await User.findOneAndUpdate(
    { _id: userId },
    [
      {
        $set: {
          lockUntil: { $cond: [reachesLimit, new Date(now.getTime() + security.accountLockMs), '$lockUntil'] },
          failedLoginAttempts: { $cond: [reachesLimit, 0, { $add: [{ $ifNull: ['$failedLoginAttempts', 0] }, 1] }] },
        },
      },
    ],
    { new: true, projection: { lockUntil: 1, email: 1 }, lean: true },
  );

  if (user?.lockUntil && user.lockUntil > now) {
    securityLog('account_locked', { userId: String(userId), until: user.lockUntil });
  }
}

export async function resetAccountFailures(user) {
  if (!user.failedLoginAttempts && !user.lockUntil) return;
  await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: 1 } });
}
