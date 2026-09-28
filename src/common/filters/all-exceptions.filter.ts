import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Error as MongooseError } from 'mongoose';
import { TooManyAttemptsException } from '../exceptions/too-many-attempts.exception';

interface ErrorBody {
  error: string;
  details?: unknown;
}

/** Renders every error as { error, details? } and never leaks internals on a 500. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    try {
      const [status, body] = this.resolve(exception);
      if (exception instanceof TooManyAttemptsException) {
        reply?.header('Retry-After', String(exception.retryAfterSeconds));
      }
      reply?.status(status).send(body);
    } catch (error) {
      this.logger.error('Failed to render an error response', error instanceof Error ? error.stack : String(error));
      reply?.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: 'Internal server error' });
    }
  }

  private resolve(exception: unknown): [number, ErrorBody] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null && 'error' in response && 'details' in response) {
        return [exception.getStatus(), response as ErrorBody];
      }
      const message = typeof response === 'string' ? response : (response as { message?: string | string[] })?.message;
      return [exception.getStatus(), { error: Array.isArray(message) ? message.join(', ') : (message ?? exception.message) }];
    }
    if ((exception as { code?: number })?.code === 11000) {
      return [HttpStatus.CONFLICT, { error: 'Email is already registered' }];
    }
    if (exception instanceof MongooseError.ValidationError || exception instanceof MongooseError.CastError) {
      return [HttpStatus.BAD_REQUEST, { error: exception.message }];
    }
    const fastifyStatus = (exception as { statusCode?: number })?.statusCode;
    if (fastifyStatus && fastifyStatus >= 400 && fastifyStatus < 500) {
      return [fastifyStatus, { error: fastifyStatus === 413 ? 'Request body too large' : 'Malformed request' }];
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return [HttpStatus.INTERNAL_SERVER_ERROR, { error: 'Internal server error' }];
  }
}
