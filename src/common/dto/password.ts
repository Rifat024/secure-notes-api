import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** At least 8 characters with a letter and a number; bcrypt only hashes the first 72 bytes. */
export const IsStrongPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(8, { message: 'Password must be at least 8 characters' }),
    MaxLength(72, { message: 'Password must be at most 72 characters' }),
    Matches(/[A-Za-z]/, { message: 'Password must contain a letter' }),
    Matches(/\d/, { message: 'Password must contain a number' }),
  );
