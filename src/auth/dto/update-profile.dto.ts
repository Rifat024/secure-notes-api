import { ArrayMaxSize, IsArray, IsOptional, IsString, Length } from 'class-validator';
import { IsStrongPassword } from '../../common/dto/password';
import { NormalizeTags, Trim } from '../../common/dto/transforms';

export class UpdateProfileDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsStrongPassword()
  password?: string;

  @IsOptional()
  @NormalizeTags()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  interests?: string[];
}
