import { Logger } from '@nestjs/common';

const logger = new Logger('Security');

export function securityLog(event: string, details: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === 'test') return;
  try {
    logger.warn(JSON.stringify({ event, at: new Date().toISOString(), ...details }));
  } catch {
    logger.warn(`${event} (details could not be serialised)`);
  }
}
