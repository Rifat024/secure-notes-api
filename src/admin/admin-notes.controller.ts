import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/roles';
import { AdminNotesQueryDto } from '../notes/dto/note.dto';
import { NotesService } from '../notes/notes.service';
import { rethrow } from '../common/utils/rethrow';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/decorators/api-errors.decorator';
import { Paginated } from '../common/dto/page.response';
import { AdminNoteResponse } from '../notes/dto/note.response';

@ApiTags('Admin')
@ApiBearerAuth('jwt')
@ApiErrors(401, 403, 429)
@Roles(Role.Admin)
@Controller('admin/notes')
export class AdminNotesController {
  constructor(private readonly notes: NotesService) {}

  @ApiOperation({ summary: "List everyone's notes", description: 'Newest first; ?owner= narrows to one user via the { owner: 1, _id: -1 } index.' })
  @ApiOkResponse({ type: Paginated(AdminNoteResponse) })
  @ApiErrors(400)
  @Get()
  async list(@Query() query: AdminNotesQueryDto) {
    try {
      return await this.notes.listAll(query);
    } catch (error) {
      rethrow(error, 'AdminNotesController.list');
    }
  }
}
