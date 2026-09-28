import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidationIssue {
  @ApiProperty({ example: 'password' })
  path: string;

  @ApiProperty({ example: 'Password must contain a number' })
  message: string;
}

export class ErrorResponse {
  @ApiProperty({ example: 'Validation failed' })
  error: string;

  @ApiPropertyOptional({ type: [ValidationIssue] })
  details?: ValidationIssue[];
}
