import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { Trim } from '../../common/dto/transforms.js';

export class CreatePostDto {
  @ApiProperty({ example: 'Opening theory' })
  @Trim()
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({ example: 'Notes on the Sicilian Defence.' })
  @Trim()
  @IsString()
  @Length(1, 20000)
  body: string;
}
