import { Logger } from '@nestjs/common';
import type { FastifyInstance } from 'fastify';
import { clientIp } from '../utils/client-ip.js';

const logger = new Logger('HTTP');

/** Logs one line per request at a level matching the outcome: 5xx error, 4xx warn, otherwise log. */
export function registerRequestLogging(fastify: FastifyInstance): void {
  fastify.addHook('onResponse', async (request, reply) => {
    try {
      const status = reply?.statusCode ?? 0;
      const line = `${request?.method} ${request?.url} ${status} ${Math.round(reply?.elapsedTime ?? 0)}ms ip=${clientIp(request)}`;
      if (status >= 500) logger.error(line);
      else if (status >= 400) logger.warn(line);
      else logger.log(line);
    } catch (error) {
      logger.debug(`Request log skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
