import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthUser, Role } from '../common/roles';
import { buildPage, PageQuery, parsePagination } from '../common/utils/pagination';
import { compact } from '../common/utils/compact';
import { rethrow } from '../common/utils/rethrow';
import { NotesRepository } from '../notes/notes.repository';
import { PostsRepository } from '../posts/posts.repository';
import { AdminCreateUserDto, AdminUpdateUserDto } from './dto/admin-user.dto';
import { UserDocument } from './schemas/user.schema';
import { UsersRepository } from './users.repository';
import { Traced } from '../common/logging/traced.decorator';

interface ProfileChanges {
  name?: string;
  password?: string;
  interests?: string[];
}

@Traced()
@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly notes: NotesRepository,
    private readonly posts: PostsRepository,
  ) {}

  async create(dto: AdminCreateUserDto): Promise<UserDocument> {
    try {
      return await this.users.create({ ...dto, role: dto?.role ?? Role.User });
    } catch (error) {
      rethrow(error, 'UsersService.create');
    }
  }

  async findById(id: string) {
    try {
      const user = await this.users.findById(id);
      if (!user) throw new NotFoundException('User not found');
      return user;
    } catch (error) {
      rethrow(error, 'UsersService.findById');
    }
  }

  async getPublicProfile(id: string) {
    try {
      const user = await this.users.findPublicProfile(id);
      if (!user) throw new NotFoundException('User not found');
      return user;
    } catch (error) {
      rethrow(error, 'UsersService.getPublicProfile');
    }
  }

  /** Applies profile changes; a new password revokes every existing session. */
  async updateProfile(id: string, changes: ProfileChanges): Promise<{ user: UserDocument; sessionsRevoked: boolean }> {
    try {
      const updates = compact(changes);
      if (Object.keys(updates).length === 0) throw new BadRequestException('Nothing to update');
      const user = await this.users.findForUpdate(id);
      if (!user) throw new NotFoundException('User not found');
      Object.assign(user, updates);
      const sessionsRevoked = Boolean(updates.password);
      if (sessionsRevoked) user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      return { user: await this.users.save(user), sessionsRevoked };
    } catch (error) {
      rethrow(error, 'UsersService.updateProfile');
    }
  }

  async revokeSessions(id: string): Promise<void> {
    try {
      await this.users.incrementTokenVersion(id);
    } catch (error) {
      rethrow(error, 'UsersService.revokeSessions');
    }
  }

  async list(query: PageQuery) {
    try {
      return await this.users.paginate(query);
    } catch (error) {
      rethrow(error, 'UsersService.list');
    }
  }

  /** A password or role change revokes the user's sessions so new permissions apply at once. */
  async adminUpdate(id: string, dto: AdminUpdateUserDto, actor: AuthUser) {
    try {
      const updates = compact(dto);
      if (Object.keys(updates).length === 0) throw new BadRequestException('Nothing to update');
      if (id === actor?.id && updates.role && updates.role !== actor?.role) {
        throw new BadRequestException('Admins cannot change their own role');
      }
      const user = await this.users.findForUpdate(id);
      if (!user) throw new NotFoundException('User not found');
      const revoke = Boolean(updates.password) || (updates.role !== undefined && updates.role !== user.role);
      Object.assign(user, updates);
      if (revoke) user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      return (await this.users.save(user))?.toJSON();
    } catch (error) {
      rethrow(error, 'UsersService.adminUpdate');
    }
  }

  /** Removes the user together with their notes and posts. */
  async adminDelete(id: string, actor: AuthUser): Promise<void> {
    try {
      if (id === actor?.id) throw new BadRequestException('Admins cannot delete their own account');
      const userId = new Types.ObjectId(id);
      const deleted = await this.users.delete(userId);
      if (!deleted) throw new NotFoundException('User not found');
      await Promise.all([this.notes.deleteAllByOwner(userId), this.posts.deleteAllByAuthor(userId)]);
    } catch (error) {
      rethrow(error, 'UsersService.adminDelete');
    }
  }

  /** Scenario 1 — a single aggregate() call returns the grouped page and its total. */
  async usersByInterest(query: PageQuery & { interest?: string }) {
    try {
      const pagination = parsePagination(query);
      const result = await this.users.aggregateUsersByInterest({ ...pagination, interest: query?.interest });
      return buildPage(result?.items ?? [], result?.total ?? 0, pagination);
    } catch (error) {
      rethrow(error, 'UsersService.usersByInterest');
    }
  }

  /** Scenario 2 — one pipeline on users with a $lookup into posts. */
  async userPosts(userId: string, query: PageQuery) {
    try {
      const pagination = parsePagination(query);
      const result = await this.users.aggregateUserPosts({ ...pagination, userId });
      if (!result) throw new NotFoundException('User not found');
      return { author: result?.author, ...buildPage(result?.posts ?? [], result?.total ?? 0, pagination) };
    } catch (error) {
      rethrow(error, 'UsersService.userPosts');
    }
  }
}
