import { Controller, Get, Param, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { InterestQueryDto } from './dto/interest-query.dto';
import { UsersService } from './users.service';
import { rethrow } from '../common/utils/rethrow';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('interests')
  async byInterest(@Query() query: InterestQueryDto) {
    try {
      return await this.users.usersByInterest(query);
    } catch (error) {
      rethrow(error, 'UsersController.byInterest');
    }
  }

  @Get(':id')
  async profile(@Param('id', ParseObjectIdPipe) id: string) {
    try {
      return await this.users.getPublicProfile(id);
    } catch (error) {
      rethrow(error, 'UsersController.profile');
    }
  }

  @Get(':id/posts')
  async posts(@Param('id', ParseObjectIdPipe) id: string, @Query() query: PaginationQueryDto) {
    try {
      return await this.users.userPosts(id, query);
    } catch (error) {
      rethrow(error, 'UsersController.posts');
    }
  }
}
