import type { FastifyInstance } from 'fastify';
import sjson from 'secure-json-parse';

/**
 * Accepts an empty body with Content-Type: application/json (clients send the header on DELETE)
 * while keeping Fastify's prototype-poisoning protection for non-empty bodies.
 */
export function registerJsonParser(fastify: FastifyInstance): void {
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    try {
      const text = typeof body === 'string' ? body : body?.toString('utf8');
      done(null, text?.trim() ? sjson.parse(text, undefined, { protoAction: 'error', constructorAction: 'error' }) : undefined);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      Object.assign(err, { statusCode: 400 });
      done(err, undefined);
    }
  });
}
