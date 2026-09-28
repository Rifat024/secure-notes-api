import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { rethrowDbError } from '../common/database/db-error.js';
import { LoginThrottle } from './schemas/login-throttle.schema.js';
import { Traced } from '../common/logging/traced.decorator.js';

/** Queries against loginthrottles; the client IP is the _id, so all of them use the _id index. */
@Traced()
@Injectable()
export class LoginThrottleRepository {
  constructor(@InjectModel(LoginThrottle.name) private readonly model: Model<LoginThrottle>) {}

  async findBlock(ip: string) {
    try {
      return await this.model.findById(ip, { blockedUntil: 1 }).lean().exec();
    } catch (error) {
      rethrowDbError(error, 'LoginThrottleRepository.findBlock');
    }
  }

  /**
   * Counts a failure inside a sliding window and sets blockedUntil once the limit is reached,
   * in one atomic upsert.
   */
  async recordFailure(ip: string, { windowStart, maxFailures, blockUntil }: { windowStart: Date; maxFailures: number; blockUntil: Date }) {
    const now = new Date();
    const inWindow = { $gt: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, windowStart] };
    try {
      return await this.model
        .findOneAndUpdate(
          { _id: ip },
          [
            {
              $set: {
                failures: { $cond: [inWindow, { $add: [{ $ifNull: ['$failures', 0] }, 1] }, 1] },
                windowStartedAt: { $cond: [inWindow, '$windowStartedAt', now] },
              },
            },
            { $set: { blockedUntil: { $cond: [{ $gte: ['$failures', maxFailures] }, blockUntil, '$blockedUntil'] } } },
          ],
          { upsert: true, new: true, updatePipeline: true },
        )
        .lean()
        .exec();
    } catch (error) {
      rethrowDbError(error, 'LoginThrottleRepository.recordFailure');
    }
  }
}
