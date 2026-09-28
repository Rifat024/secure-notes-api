import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply } from 'fastify';
import { SECURITY } from '../../config/security.config.js';
import { RATE_LIMIT_KEY, RateLimitRule, SKIP_RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator.js';
import { clientIp } from '../utils/client-ip.js';
import { rethrow } from '../utils/rethrow.js';
import { securityLog } from '../utils/security-log.js';

interface Window {
  count: number;
  resetAt: number;
}

/** Expired windows are swept after this many new windows so memory stays bounded. */
const SWEEP_EVERY = 1000;

/**
 * Fixed-window request limits per client IP and route, held in memory for this instance.
 * Failed sign-ins are additionally tracked in MongoDB (see auth/login-guard.service.ts) so
 * lockouts hold across instances.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();
  private created = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      if (process.env.NODE_ENV === 'test') return true;
      const targets = [context.getHandler(), context.getClass()];
      if (this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, targets)) return true;

      const rule = this.reflector.getAllAndOverride<RateLimitRule>(RATE_LIMIT_KEY, targets) ?? SECURITY.apiRateLimit;
      const http = context.switchToHttp();
      const request = http.getRequest();
      const reply = http.getResponse<FastifyReply>();
      const ip = clientIp(request);
      const key = `${context.getClass()?.name}.${context.getHandler()?.name}:${ip}`;
      const window = this.hit(key, rule);

      const retryAfter = Math.max(1, Math.ceil((window.resetAt - Date.now()) / 1000));
      reply?.header('RateLimit-Limit', String(rule.limit));
      reply?.header('RateLimit-Remaining', String(Math.max(0, rule.limit - window.count)));
      reply?.header('RateLimit-Reset', String(retryAfter));
      if (window.count <= rule.limit) return true;

      reply?.header('Retry-After', String(retryAfter));
      securityLog('rate_limited', { ip, path: request?.url, limit: rule.limit });
      throw new HttpException('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS);
    } catch (error) {
      rethrow(error, 'RateLimitGuard.canActivate');
    }
  }

  private hit(key: string, rule: RateLimitRule): Window {
    const now = Date.now();
    const current = this.windows.get(key);
    if (current && current.resetAt > now) {
      current.count += 1;
      return current;
    }
    const fresh = { count: 1, resetAt: now + rule.ttl };
    this.windows.set(key, fresh);
    if (++this.created % SWEEP_EVERY === 0) this.sweep(now);
    return fresh;
  }

  private sweep(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
