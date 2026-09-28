import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponse } from '../dto/error.response';

const DESCRIPTIONS: Record<number, string> = {
  400: 'Validation failed or malformed request',
  401: 'Missing, invalid, expired, or revoked token',
  403: 'Authenticated but not allowed (admin only)',
  404: 'Resource not found or not owned by the caller',
  409: 'Email is already registered',
  429: 'Rate limited or locked out; see the Retry-After header',
};

/** Documents the standard `{ error, details? }` error responses for the given status codes. */
export const ApiErrors = (...statuses: number[]) =>
  applyDecorators(...statuses.map((status) => ApiResponse({ status, description: DESCRIPTIONS[status], type: ErrorResponse })));
