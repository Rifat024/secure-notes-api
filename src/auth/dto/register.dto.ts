import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsStrongPassword } from '../../common/dto/password';
import { NormalizeTags, Trim, TrimLower } from '../../common/dto/transforms';

export class RegisterDto {
  @Trim()
  @IsString()
  @Length(1, 80)
  name: string;

  @TrimLower()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsStrongPassword()
  password: string;

  @IsOptional()
  @NormalizeTags()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  interests?: string[];
}
