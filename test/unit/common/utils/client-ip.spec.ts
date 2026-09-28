import { clientIp } from '../../../../src/common/utils/client-ip.js';

describe('clientIp', () => {
  afterEach(() => {
    delete process.env.VERCEL;
    delete process.env.CLIENT_IP_HEADER;
  });

  it('uses request.ip when no edge header is configured', () => {
    expect(clientIp({ ip: '10.0.0.1', headers: { 'x-vercel-forwarded-for': '1.2.3.4' } })).toBe('10.0.0.1');
  });

  it('uses the Vercel edge header on Vercel', () => {
    process.env.VERCEL = '1';
    expect(clientIp({ ip: '10.0.0.1', headers: { 'x-vercel-forwarded-for': '1.2.3.4, 5.6.7.8' } })).toBe('1.2.3.4');
  });

  it('uses the header named by CLIENT_IP_HEADER, case-insensitively', () => {
    process.env.CLIENT_IP_HEADER = 'CF-Connecting-IP';
    expect(clientIp({ ip: '10.0.0.1', headers: { 'cf-connecting-ip': '203.0.113.4', 'x-forwarded-for': '6.6.6.6' } })).toBe('203.0.113.4');
  });

  it('falls back to request.ip when the configured header is absent', () => {
    process.env.CLIENT_IP_HEADER = 'cf-connecting-ip';
    expect(clientIp({ ip: '10.0.0.1', headers: {} })).toBe('10.0.0.1');
  });

  it('falls back safely', () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } } as never)).toBe('127.0.0.1');
    expect(clientIp(undefined)).toBe('unknown');
  });
});
