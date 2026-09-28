import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser, Role } from '../common/roles.js';
import { PageQuery } from '../common/utils/pagination.js';
import { compact } from '../common/utils/compact.js';
import { rethrow } from '../common/utils/rethrow.js';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto.js';
import { NotesRepository } from './notes.repository.js';
import { Traced } from '../common/logging/traced.decorator.js';

@Traced()
@Injectable()
export class NotesService {
  constructor(private readonly notes: NotesRepository) {}

  async listForOwner(ownerId: string, query: PageQuery) {
    try {
      return await this.notes.paginateByOwner(ownerId, query);
    } catch (error) {
      rethrow(error, 'NotesService.listForOwner');
    }
  }

  async listAll(query: PageQuery & { owner?: string }) {
    try {
      return await this.notes.paginateAll(query, query?.owner);
    } catch (error) {
      rethrow(error, 'NotesService.listAll');
    }
  }

  async create(ownerId: string, dto: CreateNoteDto) {
    try {
      return await this.notes.create(ownerId, dto);
    } catch (error) {
      rethrow(error, 'NotesService.create');
    }
  }

  /** Owners see their own notes; admins may read any single note. */
  async findVisible(id: string, user: AuthUser) {
    try {
      const note = user?.role === Role.Admin ? await this.notes.findById(id) : await this.notes.findOwned(id, user?.id);
      if (!note) throw new NotFoundException('Note not found');
      return note;
    } catch (error) {
      rethrow(error, 'NotesService.findVisible');
    }
  }

  async update(id: string, ownerId: string, dto: UpdateNoteDto) {
    try {
      const changes = compact(dto);
      if (Object.keys(changes).length === 0) throw new BadRequestException('Nothing to update');
      const note = await this.notes.updateOwned(id, ownerId, changes);
      if (!note) throw new NotFoundException('Note not found');
      return note;
    } catch (error) {
      rethrow(error, 'NotesService.update');
    }
  }

  async remove(id: string, ownerId: string): Promise<void> {
    try {
      const deleted = await this.notes.deleteOwned(id, ownerId);
      if (!deleted) throw new NotFoundException('Note not found');
    } catch (error) {
      rethrow(error, 'NotesService.remove');
    }
  }
}
