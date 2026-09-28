const int = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const MINUTE = 60 * 1000;

export const security = Object.freeze({
  jwtIssuer: 'secure-notes-api',
  jwtAudience: 'secure-notes-web',

  /** Failed logins for one account before it is locked. */
  accountMaxFailures: int('ACCOUNT_MAX_FAILURES', 5),
  accountLockMs: int('ACCOUNT_LOCK_MINUTES', 15) * MINUTE,

  /** Failed logins from one IP within the window before the IP is blocked from signing in. */
  ipMaxFailures: int('IP_MAX_FAILURES', 10),
  ipWindowMs: int('IP_WINDOW_MINUTES', 15) * MINUTE,
  ipBlockMs: int('IP_BLOCK_MINUTES', 30) * MINUTE,

  apiRateLimit: { windowMs: 15 * MINUTE, limit: int('API_RATE_LIMIT', 300) },
  authRateLimit: { windowMs: 15 * MINUTE, limit: int('AUTH_RATE_LIMIT', 20) },
  registerRateLimit: { windowMs: 60 * MINUTE, limit: int('REGISTER_RATE_LIMIT', 10) },
});
