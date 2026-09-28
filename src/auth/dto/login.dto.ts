import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';
import { TrimLower } from '../../common/dto/transforms';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @TrimLower()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@12345' })
  @IsString()
  @Length(1, 72)
  password: string;
}
