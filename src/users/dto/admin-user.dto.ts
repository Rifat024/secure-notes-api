import { ArrayMaxSize, IsArray, IsEmail, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsStrongPassword } from '../../common/dto/password';
import { NormalizeTags, Trim, TrimLower } from '../../common/dto/transforms';
import { Role } from '../../common/roles';
import { RegisterDto } from '../../auth/dto/register.dto';

export class AdminCreateUserDto extends RegisterDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class AdminUpdateUserDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @TrimLower()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsStrongPassword(false)
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @NormalizeTags()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  interests?: string[];
}
