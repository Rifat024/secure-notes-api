import type { FastifyRequest } from 'fastify';

type RequestLike = Pick<FastifyRequest, 'ip' | 'headers'> & { socket?: { remoteAddress?: string } };

/**
 * Vercel overwrites x-vercel-forwarded-for at its edge, so callers cannot spoof it; elsewhere
 * Fastify resolves request.ip, honouring X-Forwarded-For only from TRUST_PROXY addresses.
 */
export function clientIp(req: Partial<RequestLike> | undefined): string {
  try {
    const edgeIp = req?.headers?.['x-vercel-forwarded-for'];
    if (process.env.VERCEL && typeof edgeIp === 'string' && edgeIp.length > 0) {
      return edgeIp.split(',')[0]?.trim() || 'unknown';
    }
    return req?.ip ?? req?.socket?.remoteAddress ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
