import { HttpException, InternalServerErrorException, Logger } from '@nestjs/common';

const logger = new Logger('Application');

/**
 * Lets intentional HTTP errors (404, 403, 429, …) pass through unchanged and turns anything
 * unexpected into a logged 500, tagged with the operation that failed.
 */
export function rethrow(error: unknown, operation: string): never {
  if (error instanceof HttpException) throw error;
  logger.error(`${operation} failed`, error instanceof Error ? error.stack : String(error));
  throw new InternalServerErrorException();
}
