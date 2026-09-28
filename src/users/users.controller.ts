import { Controller, Get, Param, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { InterestQueryDto } from './dto/interest-query.dto';
import { UsersService } from './users.service';
import { rethrow } from '../common/utils/rethrow';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/decorators/api-errors.decorator';
import { Paginated } from '../common/dto/page.response';
import { UserPostsResponse } from '../posts/dto/post.response';
import { InterestGroupResponse, PublicProfileResponse } from './dto/user.response';

@ApiTags('Users & aggregations')
@ApiBearerAuth('jwt')
@ApiErrors(401, 429)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @ApiOperation({
    summary: 'Scenario 1: users grouped by interest',
    description:
      'A single aggregate() call: $match (interests index) → $unwind → $group → $sort → $facet (page and total). Pass ?interest= for one group.',
  })
  @ApiOkResponse({ type: Paginated(InterestGroupResponse) })
  @ApiErrors(400)
  @Get('interests')
  async byInterest(@Query() query: InterestQueryDto) {
    try {
      return await this.users.usersByInterest(query);
    } catch (error) {
      rethrow(error, 'UsersController.byInterest');
    }
  }

  @ApiOperation({ summary: 'Public profile of a user' })
  @ApiOkResponse({ type: PublicProfileResponse })
  @ApiErrors(400, 404)
  @Get(':id')
  async profile(@Param('id', ParseObjectIdPipe) id: string) {
    try {
      return await this.users.getPublicProfile(id);
    } catch (error) {
      rethrow(error, 'UsersController.profile');
    }
  }

  @ApiOperation({
    summary: "Scenario 2: a user's posts via $lookup",
    description: 'One pipeline on users: $match on _id, then $lookup into posts (author index) for the page and the count.',
  })
  @ApiOkResponse({ type: UserPostsResponse })
  @ApiErrors(400, 404)
  @Get(':id/posts')
  async posts(@Param('id', ParseObjectIdPipe) id: string, @Query() query: PaginationQueryDto) {
    try {
      return await this.users.userPosts(id, query);
    } catch (error) {
      rethrow(error, 'UsersController.posts');
    }
  }
}
