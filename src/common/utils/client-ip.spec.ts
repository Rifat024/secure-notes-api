import { clientIp } from './client-ip';

describe('clientIp', () => {
  afterEach(() => delete process.env.VERCEL);

  it('uses request.ip outside Vercel and ignores the edge header', () => {
    expect(clientIp({ ip: '10.0.0.1', headers: { 'x-vercel-forwarded-for': '1.2.3.4' } })).toBe('10.0.0.1');
  });

  it('uses the Vercel edge header on Vercel', () => {
    process.env.VERCEL = '1';
    expect(clientIp({ ip: '10.0.0.1', headers: { 'x-vercel-forwarded-for': '1.2.3.4, 5.6.7.8' } })).toBe('1.2.3.4');
  });

  it('falls back safely', () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } } as never)).toBe('127.0.0.1');
    expect(clientIp(undefined)).toBe('unknown');
  });
});
