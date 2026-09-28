import { IsEmail, IsString, Length } from 'class-validator';
import { TrimLower } from '../../common/dto/transforms';

export class LoginDto {
  @TrimLower()
  @IsEmail()
  email: string;

  @IsString()
  @Length(1, 72)
  password: string;
}
