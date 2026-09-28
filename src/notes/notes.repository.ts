import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { QueryFilter } from 'mongoose';
import { rethrowDbError } from '../common/database/db-error.js';
import { PageQuery, paginateFind } from '../common/utils/pagination.js';
import { Note } from './schemas/note.schema.js';
import { Traced } from '../common/logging/traced.decorator.js';

const oid = (id: string | Types.ObjectId) => (typeof id === 'string' ? new Types.ObjectId(id) : id);

/** Every query against the notes collection. Each one is served by _id or { owner: 1, _id: -1 }. */
@Traced()
@Injectable()
export class NotesRepository {
  constructor(@InjectModel(Note.name) private readonly model: Model<Note>) {}

  async paginateByOwner(ownerId: string, query: PageQuery) {
    try {
      return await paginateFind(this.model, { owner: oid(ownerId) }, query);
    } catch (error) {
      rethrowDbError(error, 'NotesRepository.paginateByOwner');
    }
  }

  async paginateAll(query: PageQuery, ownerId?: string) {
    try {
      const filter: QueryFilter<Note> = ownerId ? { owner: oid(ownerId) } : {};
      return await paginateFind(this.model, filter, query, { populate: { path: 'owner', select: 'name email' } });
    } catch (error) {
      rethrowDbError(error, 'NotesRepository.paginateAll');
    }
  }

  async create(ownerId: string, data: { title: string; content?: string }) {
    try {
      const note = await this.model.create({ ...data, owner: oid(ownerId) });
      return note.toJSON();
    } catch (error) {
      rethrowDbError(error, 'NotesRepository.create');
    }
  }

  async findById(id: string) {
    try {
      return await this.model.findById(id).lean().exec();
    } catch (error) {
      rethrowDbError(error, 'NotesRepository.findById');
    }
  }

  async findOwned(id: string, ownerId: string) {
    try {
      return await this.model.findOne({ _id: id, owner: oid(ownerId) }).lean().exec();
    } catch (error) {
      rethrowDbError(error, 'NotesRepository.findOwned');
    }
  }

  async updateOwned(id: string, ownerId: string, changes: { title?: string; content?: string }) {
    try {
      return await this.model
        .findOneAndUpdate({ _id: id, owner: oid(ownerId) }, { $set: changes }, { new: true, runValidators: true })
        .lean()
        .exec();
    } catch (error) {
      rethrowDbError(error, 'NotesRepository.updateOwned');
    }
  }

  async deleteOwned(id: string, ownerId: string): Promise<boolean> {
    try {
      const { deletedCount } = await this.model.deleteOne({ _id: id, owner: oid(ownerId) });
      return deletedCount > 0;
    } catch (error) {
      rethrowDbError(error, 'NotesRepository.deleteOwned');
    }
  }

  async deleteAllByOwner(ownerId: string | Types.ObjectId): Promise<void> {
    try {
      await this.model.deleteMany({ owner: oid(ownerId) });
    } catch (error) {
      rethrowDbError(error, 'NotesRepository.deleteAllByOwner');
    }
  }
}
