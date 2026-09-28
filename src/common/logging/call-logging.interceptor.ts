import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/** Controller-level counterpart of @Traced(): entry at verbose, completion or failure at debug. */
@Injectable()
export class CallLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const logger = new Logger(context.getClass()?.name ?? 'Controller');
    const handler = context.getHandler()?.name ?? 'handler';
    const started = performance.now();
    const elapsed = () => `${Math.round(performance.now() - started)}ms`;

    logger.verbose(`→ ${handler}`);
    return next.handle().pipe(
      tap({
        next: () => logger.debug(`← ${handler} ok ${elapsed()}`),
        error: (error: unknown) =>
          logger.debug(`← ${handler} failed ${error instanceof HttpException ? error.getStatus() : 500} ${elapsed()}`),
      }),
    );
  }
}
