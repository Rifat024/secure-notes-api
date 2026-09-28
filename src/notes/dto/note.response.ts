import { ApiProperty } from '@nestjs/swagger';

export class NoteResponse {
  @ApiProperty({ example: '6aba8b03021c896f17997d07' })
  _id: string;

  @ApiProperty({ description: 'Owner user id', example: '6aba8b02021c896f17997cfa' })
  owner: string;

  @ApiProperty({ example: 'Groceries' })
  title: string;

  @ApiProperty({ example: 'Milk, eggs, bread' })
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class NoteOwner {
  @ApiProperty({ example: '6aba8b02021c896f17997cfa' })
  _id: string;

  @ApiProperty({ example: 'Alice Rahman' })
  name: string;

  @ApiProperty({ example: 'alice@example.com' })
  email: string;
}

export class AdminNoteResponse extends NoteResponse {
  @ApiProperty({ type: NoteOwner })
  declare owner: string & NoteOwner;
}
