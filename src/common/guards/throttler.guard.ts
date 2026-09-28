import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { clientIp } from '../utils/client-ip';
import { rethrow } from '../utils/rethrow';
import { securityLog } from '../utils/security-log';

/**
 * Per-instance request limits keyed on the real client IP. Failed sign-ins are additionally
 * tracked in MongoDB (see auth/login-guard.service.ts) so lockouts hold across instances.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    try {
      return clientIp(req);
    } catch (error) {
      rethrow(error, 'AppThrottlerGuard.getTracker');
    }
  }

  protected override async throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    try {
      const request = context.switchToHttp().getRequest();
      securityLog('rate_limited', { ip: detail?.tracker, path: request?.url, limit: detail?.limit });
    } catch (error) {
      rethrow(error, 'AppThrottlerGuard.throwThrottlingException');
    }
    return super.throwThrottlingException(context, detail);
  }
}
