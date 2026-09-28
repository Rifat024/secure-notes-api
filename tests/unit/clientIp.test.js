import { clientIp } from '../../src/utils/clientIp.js';

describe('clientIp', () => {
  afterEach(() => {
    delete process.env.VERCEL;
  });

  test('uses req.ip outside Vercel, ignoring the edge header', () => {
    expect(clientIp({ ip: '10.0.0.1', headers: { 'x-vercel-forwarded-for': '1.2.3.4' } })).toBe('10.0.0.1');
  });

  test('uses the Vercel edge header on Vercel', () => {
    process.env.VERCEL = '1';
    expect(clientIp({ ip: '10.0.0.1', headers: { 'x-vercel-forwarded-for': '1.2.3.4, 5.6.7.8' } })).toBe('1.2.3.4');
  });

  test('falls back to the socket address', () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1');
  });
});
