import { SetMetadata } from '@nestjs/common';

export interface RateLimitRule {
  limit: number;
  ttl: number;
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

/** Replaces the global request limit for a route or controller. */
export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT_KEY, rule);

export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
