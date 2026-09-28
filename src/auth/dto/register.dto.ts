import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsStrongPassword } from '../../common/dto/password';
import { NormalizeTags, Trim, TrimLower } from '../../common/dto/transforms';

export class RegisterDto {
  @ApiProperty({ example: 'Ada Lovelace' })
  @Trim()
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiProperty({ example: 'ada@example.com' })
  @TrimLower()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsStrongPassword()
  password: string;

  @ApiProperty({ required: false, type: [String], example: ['chess', 'reading'], description: 'Stored lower-cased and de-duplicated' })
  @IsOptional()
  @NormalizeTags()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  interests?: string[];
}
