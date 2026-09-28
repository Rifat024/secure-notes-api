import { HttpException, Logger } from '@nestjs/common';

type AnyFn = (...args: unknown[]) => unknown;

const isPromise = (value: unknown): value is Promise<unknown> => typeof (value as Promise<unknown>)?.then === 'function';

function describeFailure(error: unknown): string {
  if (error instanceof HttpException) return `failed ${error.getStatus()} ${error.message}`;
  return `failed ${error instanceof Error ? error.name : 'Error'}`;
}

/**
 * Logs every method call on the class: entry at verbose, completion with its duration at debug,
 * and failures at debug (HTTP errors) or warn (unexpected; the stack is logged once by rethrow).
 * Arguments are never logged, so credentials and tokens cannot reach the logs.
 *
 * Only for services and repositories: controllers carry route metadata on their methods and are
 * traced by CallLoggingInterceptor instead.
 */
export function Traced(): ClassDecorator {
  return (target) => {
    const logger = new Logger(target.name);
    const proto = (target as unknown as { prototype: Record<string, unknown> }).prototype;

    for (const key of Object.getOwnPropertyNames(proto)) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (key === 'constructor' || typeof descriptor?.value !== 'function') continue;
      const original = descriptor.value as AnyFn;

      descriptor.value = function traced(this: unknown, ...args: unknown[]) {
        const started = performance.now();
        const elapsed = () => `${Math.round(performance.now() - started)}ms`;
        const onError = (error: unknown) => {
          const line = `${key} ${describeFailure(error)} ${elapsed()}`;
          if (error instanceof HttpException) logger.debug(line);
          else logger.warn(line);
        };

        logger.verbose(`→ ${key}`);
        try {
          const result = original.apply(this, args);
          if (isPromise(result)) {
            return result.then(
              (value) => {
                logger.debug(`← ${key} ok ${elapsed()}`);
                return value;
              },
              (error: unknown) => {
                onError(error);
                throw error;
              },
            );
          }
          logger.debug(`← ${key} ok ${elapsed()}`);
          return result;
        } catch (error) {
          onError(error);
          throw error;
        }
      };
      Object.defineProperty(proto, key, descriptor);
    }
  };
}
