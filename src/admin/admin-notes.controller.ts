import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/roles';
import { AdminNotesQueryDto } from '../notes/dto/note.dto';
import { NotesService } from '../notes/notes.service';
import { rethrow } from '../common/utils/rethrow';

@Roles(Role.Admin)
@Controller('admin/notes')
export class AdminNotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  async list(@Query() query: AdminNotesQueryDto) {
    try {
      return await this.notes.listAll(query);
    } catch (error) {
      rethrow(error, 'AdminNotesController.list');
    }
  }
}
