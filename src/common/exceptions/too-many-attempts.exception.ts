import { HttpException, HttpStatus } from '@nestjs/common';

/** 429 carrying the number of seconds the client must wait, sent as Retry-After. */
export class TooManyAttemptsException extends HttpException {
  readonly retryAfterSeconds: number;

  constructor(until: Date) {
    super('Too many failed sign-in attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    this.retryAfterSeconds = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
  }
}
