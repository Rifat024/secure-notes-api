import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser, Role } from '../common/roles.js';
import { PageQuery } from '../common/utils/pagination.js';
import { rethrow } from '../common/utils/rethrow.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { PostsRepository } from './posts.repository.js';
import { Traced } from '../common/logging/traced.decorator.js';

@Traced()
@Injectable()
export class PostsService {
  constructor(private readonly posts: PostsRepository) {}

  async list(query: PageQuery) {
    try {
      return await this.posts.paginate(query);
    } catch (error) {
      rethrow(error, 'PostsService.list');
    }
  }

  async create(authorId: string, dto: CreatePostDto) {
    try {
      return await this.posts.create(authorId, dto);
    } catch (error) {
      rethrow(error, 'PostsService.create');
    }
  }

  async findById(id: string) {
    try {
      const post = await this.posts.findByIdWithAuthor(id);
      if (!post) throw new NotFoundException('Post not found');
      return post;
    } catch (error) {
      rethrow(error, 'PostsService.findById');
    }
  }

  /** Authors can delete their own posts; admins can delete any. */
  async remove(id: string, user: AuthUser): Promise<void> {
    try {
      const deleted = await this.posts.delete(id, user?.role === Role.Admin ? undefined : user?.id);
      if (!deleted) throw new NotFoundException('Post not found');
    } catch (error) {
      rethrow(error, 'PostsService.remove');
    }
  }
}
