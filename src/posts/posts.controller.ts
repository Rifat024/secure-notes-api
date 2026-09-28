import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AuthUser } from '../common/roles';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';
import { rethrow } from '../common/utils/rethrow';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  async list(@Query() query: PaginationQueryDto) {
    try {
      return await this.posts.list(query);
    } catch (error) {
      rethrow(error, 'PostsController.list');
    }
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    try {
      return await this.posts.create(user.id, dto);
    } catch (error) {
      rethrow(error, 'PostsController.create');
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    try {
      return await this.posts.findById(id);
    } catch (error) {
      rethrow(error, 'PostsController.findOne');
    }
  }

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
