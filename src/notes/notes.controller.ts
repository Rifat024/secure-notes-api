import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AuthUser } from '../common/roles';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { NotesService } from './notes.service';
import { rethrow } from '../common/utils/rethrow';

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    try {
      return await this.notes.listForOwner(user.id, query);
    } catch (error) {
      rethrow(error, 'NotesController.list');
    }
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto) {
    try {
      return await this.notes.create(user.id, dto);
    } catch (error) {
      rethrow(error, 'NotesController.create');
    }
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    try {
      return await this.notes.findVisible(id, user);
    } catch (error) {
      rethrow(error, 'NotesController.findOne');
    }
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateNoteDto) {
    try {
      return await this.notes.update(id, user.id, dto);
    } catch (error) {
      rethrow(error, 'NotesController.update');
    }
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    try {
      return await this.notes.remove(id, user.id);
    } catch (error) {
      rethrow(error, 'NotesController.remove');
    }
  }
}
