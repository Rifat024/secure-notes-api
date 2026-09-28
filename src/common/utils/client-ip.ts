import type { FastifyRequest } from 'fastify';

type RequestLike = Pick<FastifyRequest, 'ip' | 'headers'> & { socket?: { remoteAddress?: string } };

/**
 * The header named by CLIENT_IP_HEADER must be one the hosting platform's edge overwrites, so
 * callers cannot spoof it. On Vercel it defaults to x-vercel-forwarded-for. Without one, Fastify
 * resolves request.ip, honouring X-Forwarded-For only from TRUST_PROXY addresses.
 */
export function clientIp(req: Partial<RequestLike> | undefined): string {
  try {
    const header = process.env.CLIENT_IP_HEADER?.trim().toLowerCase() || (process.env.VERCEL ? 'x-vercel-forwarded-for' : '');
    const raw = header ? req?.headers?.[header] : undefined;
    const edgeIp = (Array.isArray(raw) ? raw[0] : raw)?.split(',')[0]?.trim();
    if (edgeIp) return edgeIp;
    return req?.ip ?? req?.socket?.remoteAddress ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
