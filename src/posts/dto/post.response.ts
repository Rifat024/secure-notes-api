import { Paginated } from '../../common/dto/page.response.js';
import { ApiProperty } from '@nestjs/swagger';

export class PostAuthor {
  @ApiProperty({ example: '6aba8b02021c896f17997cfa' })
  _id: string;

  @ApiProperty({ example: 'Alice Rahman' })
  name: string;
}

export class PostResponse {
  @ApiProperty({ example: '6aba8b03021c896f17997d10' })
  _id: string;

  @ApiProperty({ type: PostAuthor })
  author: PostAuthor;

  @ApiProperty({ example: 'Opening theory' })
  title: string;

  @ApiProperty({ example: 'Notes on the Sicilian Defence.' })
  body: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class AuthoredPost {
  @ApiProperty({ example: '6aba8b03021c896f17997d10' })
  _id: string;

  @ApiProperty({ example: 'Opening theory' })
  title: string;

  @ApiProperty({ example: 'Notes on the Sicilian Defence.' })
  body: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UserPostsAuthor {
  @ApiProperty({ example: '6aba8b02021c896f17997cfa' })
  _id: string;

  @ApiProperty({ example: 'Alice Rahman' })
  name: string;

  @ApiProperty({ type: [String], example: ['chess', 'reading'] })
  interests: string[];
}

export class UserPostsResponse extends Paginated(AuthoredPost) {
  @ApiProperty({ type: UserPostsAuthor })
  author: UserPostsAuthor;
}
