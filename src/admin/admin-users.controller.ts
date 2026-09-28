import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AuthUser, Role } from '../common/roles';
import { AdminCreateUserDto, AdminUpdateUserDto } from '../users/dto/admin-user.dto';
import { UsersService } from '../users/users.service';
import { rethrow } from '../common/utils/rethrow';

@Roles(Role.Admin)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(@Query() query: PaginationQueryDto) {
    try {
      return await this.users.list(query);
    } catch (error) {
      rethrow(error, 'AdminUsersController.list');
    }
  }

  @Post()
  async create(@Body() dto: AdminCreateUserDto) {
    try {
      return (await this.users.create(dto))?.toJSON();
    } catch (error) {
      rethrow(error, 'AdminUsersController.create');
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    try {
      return await this.users.findById(id);
    } catch (error) {
      rethrow(error, 'AdminUsersController.findOne');
    }
  }

  @Patch(':id')
  async update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: AdminUpdateUserDto, @CurrentUser() actor: AuthUser) {
    try {
      return await this.users.adminUpdate(id, dto, actor);
    } catch (error) {
      rethrow(error, 'AdminUsersController.update');
    }
  }

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
