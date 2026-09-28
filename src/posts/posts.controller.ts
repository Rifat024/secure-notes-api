import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { AuthUser } from '../common/roles.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { PostsService } from './posts.service.js';
import { rethrow } from '../common/utils/rethrow.js';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../common/decorators/api-errors.decorator.js';
import { Paginated } from '../common/dto/page.response.js';
import { PostResponse } from './dto/post.response.js';

@ApiTags('Posts')
@ApiBearerAuth('jwt')
@ApiErrors(401, 429)
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @ApiOperation({ summary: 'List all posts', description: 'Posts are public to every signed-in user. Newest first.' })
  @ApiOkResponse({ type: Paginated(PostResponse) })
  @ApiErrors(400)
  @Get()
  async list(@Query() query: PaginationQueryDto) {
    try {
      return await this.posts.list(query);
    } catch (error) {
      rethrow(error, 'PostsController.list');
    }
  }

  @ApiOperation({ summary: 'Publish a post' })
  @ApiCreatedResponse({ type: PostResponse })
  @ApiErrors(400)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    try {
      return await this.posts.create(user.id, dto);
    } catch (error) {
      rethrow(error, 'PostsController.create');
    }
  }

  @ApiOperation({ summary: 'Get a post' })
  @ApiOkResponse({ type: PostResponse })
  @ApiErrors(400, 404)
  @Get(':id')
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    try {
      return await this.posts.findById(id);
    } catch (error) {
      rethrow(error, 'PostsController.findOne');
    }
  }

  @ApiOperation({ summary: 'Delete a post', description: 'Authors can delete their own posts; admins can delete any post.' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiErrors(400, 404)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    try {
      return await this.posts.remove(id, user);
    } catch (error) {
      rethrow(error, 'PostsController.remove');
    }
  }
}
