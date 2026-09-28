import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { SECURITY } from '../config/security.config.js';
import { TooManyAttemptsException } from '../common/exceptions/too-many-attempts.exception.js';
import { rethrow } from '../common/utils/rethrow.js';
import { securityLog } from '../common/utils/security-log.js';
import { UsersRepository } from '../users/users.repository.js';
import { LoginThrottleRepository } from './login-throttle.repository.js';
import { Traced } from '../common/logging/traced.decorator.js';

/**
 * Brute-force protection backed by MongoDB so it holds across serverless instances: an account
 * is locked after repeated wrong passwords, and an IP is blocked after repeated failures across
 * any accounts.
 */
@Traced()
@Injectable()
export class LoginGuardService {
  private readonly logger = new Logger(LoginGuardService.name);

  constructor(
    private readonly throttles: LoginThrottleRepository,
    private readonly users: UsersRepository,
  ) {}

  async assertIpAllowed(ip: string): Promise<void> {
    try {
      const record = await this.throttles.findBlock(ip);
      if (record?.blockedUntil && record.blockedUntil > new Date()) throw new TooManyAttemptsException(record.blockedUntil);
    } catch (error) {
      rethrow(error, 'LoginGuardService.assertIpAllowed');
    }
  }

  /**
   * Bookkeeping failures are logged rather than thrown, so the caller still receives the
   * sign-in error it earned instead of a 500.
   */
  async recordIpFailure(ip: string): Promise<void> {
    try {
      const now = Date.now();
      const record = await this.throttles.recordFailure(ip, {
        windowStart: new Date(now - SECURITY.ipWindowMs),
        maxFailures: SECURITY.ipMaxFailures,
        blockUntil: new Date(now + SECURITY.ipBlockMs),
      });
      this.logger.debug(`Failed sign-in from ${ip} (${record?.failures ?? 0}/${SECURITY.ipMaxFailures} in window)`);
      if (record?.failures === SECURITY.ipMaxFailures) securityLog('ip_blocked', { ip, until: record.blockedUntil });
    } catch (error) {
      this.logger.error(`Could not record failed sign-in for ${ip}`, error instanceof Error ? error.stack : String(error));
    }
  }

  async recordAccountFailure(userId: Types.ObjectId): Promise<void> {
    try {
      const lockUntil = new Date(Date.now() + SECURITY.accountLockMs);
      const user = await this.users.recordFailedLogin(userId, SECURITY.accountMaxFailures, lockUntil);
      if (user?.lockUntil && user.lockUntil > new Date()) securityLog('account_locked', { userId: String(userId), until: user.lockUntil });
    } catch (error) {
      this.logger.error(`Could not record failed sign-in for user ${userId}`, error instanceof Error ? error.stack : String(error));
    }
  }

  async resetAccountFailures(user: { _id: Types.ObjectId; failedLoginAttempts?: number; lockUntil?: Date }): Promise<void> {
    try {
      if (!user?.failedLoginAttempts && !user?.lockUntil) return;
      await this.users.resetFailedLogins(user._id);
    } catch (error) {
      rethrow(error, 'LoginGuardService.resetAccountFailures');
    }
  }
}
