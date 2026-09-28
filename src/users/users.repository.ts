import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { rethrowDbError } from '../common/database/db-error';
import { PageQuery, paginateFind } from '../common/utils/pagination';
import { userPostsPipeline, UserPostsOptions } from './pipelines/user-posts.pipeline';
import { usersByInterestPipeline, UsersByInterestOptions } from './pipelines/users-by-interest.pipeline';
import { User, UserDocument } from './schemas/user.schema';
import { Traced } from '../common/logging/traced.decorator';

/**
 * Every query against the users collection. Lookups use _id or the unique { email: 1 } index;
 * the interest aggregation starts on { interests: 1 }.
 */
@Traced()
@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private readonly model: Model<User>) {}

  async create(data: Partial<User>): Promise<UserDocument> {
    try {
      return await this.model.create(data);
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.create');
    }
  }

  /** Persists a hydrated document so validation and the password-hashing hook run. */
  async save(user: UserDocument): Promise<UserDocument> {
    try {
      return await user.save();
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.save');
    }
  }

  async findById(id: string) {
    try {
      return await this.model.findById(id).lean().exec();
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.findById');
    }
  }

  async findPublicProfile(id: string) {
    try {
      return await this.model.findById(id, { name: 1, interests: 1, createdAt: 1 }).lean().exec();
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.findPublicProfile');
    }
  }

  async findSessionUser(id: string) {
    try {
      return await this.model.findById(id, { role: 1, name: 1, email: 1, tokenVersion: 1 }).lean().exec();
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.findSessionUser');
    }
  }

  /** Loads the hash and security counters, which are excluded from every other query. */
  async findForLogin(email: string) {
    try {
      return await this.model.findOne({ email }).select('+password +failedLoginAttempts +lockUntil +tokenVersion').exec();
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.findForLogin');
    }
  }

  async findForUpdate(id: string) {
    try {
      return await this.model.findById(id).select('+tokenVersion').exec();
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.findForUpdate');
    }
  }

  async paginate(query: PageQuery) {
    try {
      return await paginateFind(this.model, {}, query);
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.paginate');
    }
  }

  async incrementTokenVersion(id: string): Promise<void> {
    try {
      await this.model.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } });
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.incrementTokenVersion');
    }
  }

  async delete(id: string | Types.ObjectId): Promise<boolean> {
    try {
      const { deletedCount } = await this.model.deleteOne({ _id: id });
      return deletedCount > 0;
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.delete');
    }
  }

  /** Counts a failed sign-in and locks the account when the limit is reached, in one atomic update. */
  async recordFailedLogin(id: Types.ObjectId, maxFailures: number, lockUntil: Date) {
    const reachesLimit = { $gte: [{ $add: [{ $ifNull: ['$failedLoginAttempts', 0] }, 1] }, maxFailures] };
    try {
      return await this.model
        .findOneAndUpdate(
          { _id: id },
          [
            {
              $set: {
                lockUntil: { $cond: [reachesLimit, lockUntil, '$lockUntil'] },
                failedLoginAttempts: { $cond: [reachesLimit, 0, { $add: [{ $ifNull: ['$failedLoginAttempts', 0] }, 1] }] },
              },
            },
          ],
          { new: true, projection: { lockUntil: 1 } },
        )
        .lean()
        .exec();
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.recordFailedLogin');
    }
  }

  async resetFailedLogins(id: Types.ObjectId): Promise<void> {
    try {
      await this.model.updateOne({ _id: id }, { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: 1 } });
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.resetFailedLogins');
    }
  }

  async aggregateUsersByInterest(options: UsersByInterestOptions) {
    try {
      const [result] = await this.model.aggregate<{ items: unknown[]; total: number }>(usersByInterestPipeline(options));
      return result;
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.aggregateUsersByInterest');
    }
  }

  async aggregateUserPosts(options: UserPostsOptions) {
    try {
      const [result] = await this.model.aggregate<{ author: unknown; posts: unknown[]; total: number }>(userPostsPipeline(options));
      return result;
    } catch (error) {
      rethrowDbError(error, 'UsersRepository.aggregateUserPosts');
    }
  }
}
