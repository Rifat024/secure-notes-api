import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

const flatten = (errors: ValidationError[] = [], parent = ''): { path: string; message: string }[] =>
  errors.flatMap((err) => {
    const path = parent ? `${parent}.${err?.property}` : String(err?.property);
    const own = Object.values(err?.constraints ?? {}).map((message) => ({ path, message }));
    return [...own, ...flatten(err?.children ?? [], path)];
  });

function toBadRequest(errors: ValidationError[]): BadRequestException {
  try {
    return new BadRequestException({ error: 'Validation failed', details: flatten(errors) });
  } catch {
    return new BadRequestException({ error: 'Validation failed', details: [] });
  }
}

/**
 * Strips nothing silently: unknown properties are rejected, so fields like role or owner can
 * never be smuggled into a request body.
 */
export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: toBadRequest,
  });
