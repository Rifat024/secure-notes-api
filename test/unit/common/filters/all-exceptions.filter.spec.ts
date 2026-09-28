import { jest } from '@jest/globals';
import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { TooManyAttemptsException } from '../../../../src/common/exceptions/too-many-attempts.exception.js';
import { AllExceptionsFilter } from '../../../../src/common/filters/all-exceptions.filter.js';

function mockHost() {
  const reply = { statusCode: 0, body: undefined as unknown, headers: {} as Record<string, string> };
  const api = {
    status: (code: number) => ((reply.statusCode = code), api),
    send: (body: unknown) => ((reply.body = body), api),
    header: (name: string, value: string) => ((reply.headers[name] = value), api),
  };
  const host = { switchToHttp: () => ({ getResponse: () => api }) } as unknown as ArgumentsHost;
  return { host, reply };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('renders HTTP exceptions as { error }', () => {
    const { host, reply } = mockHost();
    filter.catch(new NotFoundException('Note not found'), host);
    expect(reply).toMatchObject({ statusCode: 404, body: { error: 'Note not found' } });
  });

  it('keeps validation details', () => {
    const { host, reply } = mockHost();
    filter.catch(new BadRequestException({ error: 'Validation failed', details: [{ path: 'title', message: 'x' }] }), host);
    expect(reply.body).toEqual({ error: 'Validation failed', details: [{ path: 'title', message: 'x' }] });
  });

  it('sets Retry-After on lockouts', () => {
    const { host, reply } = mockHost();
    filter.catch(new TooManyAttemptsException(new Date(Date.now() + 90_000)), host);
    expect(reply.statusCode).toBe(429);
    expect(Number(reply.headers['Retry-After'])).toBeGreaterThanOrEqual(89);
  });

  it('maps duplicate keys to 409 and hides unknown errors', () => {
    const dup = mockHost();
    filter.catch({ code: 11000 }, dup.host);
    expect(dup.reply.statusCode).toBe(409);

    const unknown = mockHost();
    filter.catch(new Error('stack details'), unknown.host);
    expect(unknown.reply).toMatchObject({ statusCode: 500, body: { error: 'Internal server error' } });
  });
});
