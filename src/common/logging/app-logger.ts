import { ConsoleLogger, LogLevel } from '@nestjs/common';

/** Levels from most to least severe; choosing one enables it and everything above it. */
const LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

export function resolveLogLevels(level: string | undefined): LogLevel[] {
  try {
    const index = LEVELS.indexOf((level ?? 'log').toLowerCase() as LogLevel);
    return LEVELS.slice(0, index === -1 ? LEVELS.indexOf('log') + 1 : index + 1);
  } catch {
    return LEVELS.slice(0, LEVELS.indexOf('log') + 1);
  }
}

/**
 * Structured JSON logs in production (one object per line, ready for Vercel log drains) and
 * readable coloured output elsewhere. LOG_LEVEL controls verbosity; tests are silent.
 */
export function createAppLogger(): ConsoleLogger | false {
  if (process.env.NODE_ENV === 'test') return false;
  const production = process.env.NODE_ENV === 'production';
  return new ConsoleLogger({
    prefix: 'SecureNotes',
    json: production,
    colors: !production,
    timestamp: !production,
    logLevels: resolveLogLevels(process.env.LOG_LEVEL),
  });
}
