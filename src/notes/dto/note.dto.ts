import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Trim } from '../../common/dto/transforms';

export class CreateNoteDto {
  @ApiProperty({ example: 'Groceries' })
  @Trim()
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({ required: false, example: 'Milk, eggs, bread' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;
}

export class UpdateNoteDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;
}

export class AdminNotesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsMongoId()
  owner?: string;
}
