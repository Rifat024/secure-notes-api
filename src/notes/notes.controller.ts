import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AuthUser } from '../common/roles';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { NotesService } from './notes.service';
import { rethrow } from '../common/utils/rethrow';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/decorators/api-errors.decorator';
import { Paginated } from '../common/dto/page.response';
import { NoteResponse } from './dto/note.response';

@ApiTags('Notes')
@ApiBearerAuth('jwt')
@ApiErrors(401, 429)
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @ApiOperation({ summary: "List the caller's notes", description: 'Newest first. Served by the { owner: 1, _id: -1 } index.' })
  @ApiOkResponse({ type: Paginated(NoteResponse) })
  @ApiErrors(400)
  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    try {
      return await this.notes.listForOwner(user.id, query);
    } catch (error) {
      rethrow(error, 'NotesController.list');
    }
  }

  @ApiOperation({ summary: 'Create a note', description: 'The owner is always the caller.' })
  @ApiCreatedResponse({ type: NoteResponse })
  @ApiErrors(400)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto) {
    try {
      return await this.notes.create(user.id, dto);
    } catch (error) {
      rethrow(error, 'NotesController.create');
    }
  }

  @ApiOperation({ summary: 'Get a note', description: 'Users can read their own notes; admins can read any note.' })
  @ApiOkResponse({ type: NoteResponse })
  @ApiErrors(400, 404)
  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    try {
      return await this.notes.findVisible(id, user);
    } catch (error) {
      rethrow(error, 'NotesController.findOne');
    }
  }

  @ApiOperation({ summary: 'Update own note' })
  @ApiOkResponse({ type: NoteResponse })
  @ApiErrors(400, 404)
  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateNoteDto) {
    try {
      return await this.notes.update(id, user.id, dto);
    } catch (error) {
      rethrow(error, 'NotesController.update');
    }
  }

  @ApiOperation({ summary: 'Delete own note' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiErrors(400, 404)
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
