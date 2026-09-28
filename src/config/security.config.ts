const int = (name: string, fallback: number): number => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const MINUTE = 60 * 1000;

export const SECURITY = Object.freeze({
  jwtIssuer: 'secure-notes-api',
  jwtAudience: 'secure-notes-web',
  /** bcrypt cost; below 10 is rejected. Lower costs trade hashing strength for sign-in latency. */
  bcryptRounds: Math.min(14, Math.max(10, int('BCRYPT_ROUNDS', 12))),

  /** Failed sign-ins for one account before it is locked. */
  accountMaxFailures: int('ACCOUNT_MAX_FAILURES', 5),
  accountLockMs: int('ACCOUNT_LOCK_MINUTES', 15) * MINUTE,

  /** Failed sign-ins from one IP within the window before the IP is blocked from signing in. */
  ipMaxFailures: int('IP_MAX_FAILURES', 10),
  ipWindowMs: int('IP_WINDOW_MINUTES', 15) * MINUTE,
  ipBlockMs: int('IP_BLOCK_MINUTES', 30) * MINUTE,

  apiRateLimit: { ttl: 15 * MINUTE, limit: int('API_RATE_LIMIT', 300) },
  authRateLimit: { ttl: 15 * MINUTE, limit: int('AUTH_RATE_LIMIT', 20) },
  registerRateLimit: { ttl: 60 * MINUTE, limit: int('REGISTER_RATE_LIMIT', 10) },

  bodyLimitBytes: 100 * 1024,
});
