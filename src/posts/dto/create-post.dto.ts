import { IsString, Length } from 'class-validator';
import { Trim } from '../../common/dto/transforms';

export class CreatePostDto {
  @Trim()
  @IsString()
  @Length(1, 200)
  title: string;

  @Trim()
  @IsString()
  @Length(1, 20000)
  body: string;
}
