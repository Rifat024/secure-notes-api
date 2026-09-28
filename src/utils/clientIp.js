/**
 * Vercel overwrites x-vercel-forwarded-for at its edge, so it cannot be spoofed by the caller;
 * elsewhere Express resolves req.ip through the configured trust proxy setting.
 */
export function clientIp(req) {
  const edgeIp = req.headers?.['x-vercel-forwarded-for'];
  if (process.env.VERCEL && typeof edgeIp === 'string' && edgeIp.length > 0) {
    return edgeIp.split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}
