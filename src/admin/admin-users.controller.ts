import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AuthUser, Role } from '../common/roles';
import { AdminCreateUserDto, AdminUpdateUserDto } from '../users/dto/admin-user.dto';
import { UsersService } from '../users/users.service';
import { rethrow } from '../common/utils/rethrow';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/decorators/api-errors.decorator';
import { Paginated } from '../common/dto/page.response';
import { UserResponse } from '../users/dto/user.response';

@ApiTags('Admin')
@ApiBearerAuth('jwt')
@ApiErrors(401, 403, 429)
@Roles(Role.Admin)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({ type: Paginated(UserResponse) })
  @ApiErrors(400)
  @Get()
  async list(@Query() query: PaginationQueryDto) {
    try {
      return await this.users.list(query);
    } catch (error) {
      rethrow(error, 'AdminUsersController.list');
    }
  }

  @ApiOperation({ summary: 'Add a user', description: 'Admins may set the role.' })
  @ApiCreatedResponse({ type: UserResponse })
  @ApiErrors(400, 409)
  @Post()
  async create(@Body() dto: AdminCreateUserDto) {
    try {
      return (await this.users.create(dto))?.toJSON();
    } catch (error) {
      rethrow(error, 'AdminUsersController.create');
    }
  }

  @ApiOperation({ summary: 'Get a user' })
  @ApiOkResponse({ type: UserResponse })
  @ApiErrors(400, 404)
  @Get(':id')
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    try {
      return await this.users.findById(id);
    } catch (error) {
      rethrow(error, 'AdminUsersController.findOne');
    }
  }

  @ApiOperation({ summary: 'Update a user', description: "A password or role change revokes that user's sessions. Admins cannot change their own role." })
  @ApiOkResponse({ type: UserResponse })
  @ApiErrors(400, 404, 409)
  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: AdminUpdateUserDto, @CurrentUser() actor: AuthUser) {
    try {
      return await this.users.adminUpdate(id, dto, actor);
    } catch (error) {
      rethrow(error, 'AdminUsersController.update');
    }
  }

  @ApiOperation({ summary: 'Remove a user', description: 'Also deletes their notes and posts. Admins cannot delete themselves.' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiErrors(400, 404)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() actor: AuthUser) {
    try {
      return await this.users.adminDelete(id, actor);
    } catch (error) {
      rethrow(error, 'AdminUsersController.remove');
    }
  }
}
