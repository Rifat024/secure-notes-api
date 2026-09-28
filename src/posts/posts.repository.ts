import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { rethrowDbError } from '../common/database/db-error';
import { PageQuery, paginateFind } from '../common/utils/pagination';
import { Post } from './schemas/post.schema';
import { Traced } from '../common/logging/traced.decorator';

const AUTHOR = { path: 'author', select: 'name' };
const oid = (id: string | Types.ObjectId) => (typeof id === 'string' ? new Types.ObjectId(id) : id);

/** Every query against the posts collection. Each one is served by _id or { author: 1, _id: -1 }. */
@Traced()
@Injectable()
export class PostsRepository {
  constructor(@InjectModel(Post.name) private readonly model: Model<Post>) {}

  async paginate(query: PageQuery) {
    try {
      return await paginateFind(this.model, {}, query, { populate: AUTHOR });
    } catch (error) {
      rethrowDbError(error, 'PostsRepository.paginate');
    }
  }

  async create(authorId: string, data: { title: string; body: string }) {
    try {
      const post = await this.model.create({ ...data, author: oid(authorId) });
      return post.toJSON();
    } catch (error) {
      rethrowDbError(error, 'PostsRepository.create');
    }
  }

  async findByIdWithAuthor(id: string) {
    try {
      return await this.model.findById(id).populate(AUTHOR).lean().exec();
    } catch (error) {
      rethrowDbError(error, 'PostsRepository.findByIdWithAuthor');
    }
  }

  async delete(id: string, authorId?: string): Promise<boolean> {
    try {
      const filter: FilterQuery<Post> = { _id: id };
      if (authorId) filter.author = oid(authorId);
      const { deletedCount } = await this.model.deleteOne(filter);
      return deletedCount > 0;
    } catch (error) {
      rethrowDbError(error, 'PostsRepository.delete');
    }
  }

  async deleteAllByAuthor(authorId: string | Types.ObjectId): Promise<void> {
    try {
      await this.model.deleteMany({ author: oid(authorId) });
    } catch (error) {
      rethrowDbError(error, 'PostsRepository.deleteAllByAuthor');
    }
  }
}
