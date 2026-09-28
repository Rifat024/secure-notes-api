import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Error as MongooseError, mongo } from 'mongoose';

const logger = new Logger('Database');

/**
 * Translates a driver or Mongoose error into the HTTP exception the client should see, logging
 * anything unexpected with the repository operation that raised it.
 */
export function rethrowDbError(error: unknown, operation: string): never {
  if (error instanceof HttpException) throw error;
  if ((error as { code?: number })?.code === 11000) throw new ConflictException('Email is already registered');
  if (error instanceof MongooseError.CastError) throw new BadRequestException('Invalid id');
  if (error instanceof MongooseError.ValidationError) throw new BadRequestException(error.message);
  if (error instanceof mongo.MongoNetworkError || error instanceof mongo.MongoServerSelectionError) {
    logger.error(`${operation}: database unreachable (${error.message})`);
    throw new ServiceUnavailableException('Database is temporarily unavailable');
  }
  logger.error(`${operation} failed`, error instanceof Error ? error.stack : String(error));
  throw new InternalServerErrorException();
}
