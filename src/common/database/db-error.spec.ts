import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Error as MongooseError, mongo } from 'mongoose';
import { rethrowDbError } from './db-error.js';

describe('rethrowDbError', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  const mapped = (error: unknown) => {
    try {
      rethrowDbError(error, 'Test.op');
    } catch (e) {
      return e;
    }
  };

  it('passes HTTP exceptions through', () => {
    const original = new NotFoundException();
    expect(mapped(original)).toBe(original);
  });

  it('maps duplicate keys to 409', () => {
    expect(mapped({ code: 11000 })).toBeInstanceOf(ConflictException);
  });

  it('maps cast and validation errors to 400', () => {
    expect(mapped(new MongooseError.CastError('ObjectId', 'x', '_id'))).toBeInstanceOf(BadRequestException);
    expect(mapped(new MongooseError.ValidationError())).toBeInstanceOf(BadRequestException);
  });

  it('maps connectivity failures to 503', () => {
    expect(mapped(new mongo.MongoNetworkError('socket closed'))).toBeInstanceOf(ServiceUnavailableException);
  });

  it('hides anything else behind a logged 500', () => {
    const error = mapped(new Error('secret connection string'));
    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as Error).message).not.toContain('secret');
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
