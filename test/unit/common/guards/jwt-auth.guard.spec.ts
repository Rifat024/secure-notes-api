import { jest } from '@jest/globals';

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { SECURITY } from '../../../../src/config/security.config.js';
import { UsersRepository } from '../../../../src/users/users.repository.js';
import { JwtAuthGuard } from '../../../../src/common/guards/jwt-auth.guard.js';

type AnyFn = (...args: any[]) => any;

const SECRET = 'unit-test-secret-unit-test-secret';
const jwt = new JwtService({ secret: SECRET, signOptions: { issuer: SECURITY.jwtIssuer, audience: SECURITY.jwtAudience } });
const userId = new Types.ObjectId();

function setup(user: Record<string, unknown> | null, isPublic = false) {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
  const users = { findSessionUser: jest.fn<AnyFn>().mockResolvedValue(user) } as unknown as UsersRepository;
  const request: Record<string, any> = { headers: {} };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new JwtAuthGuard(reflector, jwt, users), request, context };
}

describe('JwtAuthGuard', () => {
  const activeUser = { _id: userId, role: 'user', name: 'Ada', email: 'ada@example.com', tokenVersion: 2 };

  it('lets public routes through without a token', async () => {
    const { guard, context } = setup(null, true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('attaches the user for a valid token', async () => {
    const { guard, request, context } = setup(activeUser);
    request.headers.authorization = `Bearer ${jwt.sign({ sub: String(userId), role: 'user', tv: 2 })}`;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: String(userId), role: 'user', name: 'Ada', email: 'ada@example.com' });
  });

  it.each([
    ['a missing token', undefined],
    ['a malformed header', 'Token abc'],
    ['a forged token', 'Bearer not.a.jwt'],
  ])('rejects %s', async (_label, header) => {
    const { guard, request, context } = setup(activeUser);
    request.headers.authorization = header;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens with the wrong audience', async () => {
    const { guard, request, context } = setup(activeUser);
    const other = new JwtService({ secret: SECRET });
    request.headers.authorization = `Bearer ${other.sign({ sub: String(userId), tv: 2 }, { issuer: SECURITY.jwtIssuer, audience: 'someone-else' })}`;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects revoked sessions and deleted accounts', async () => {
    const revoked = setup({ ...activeUser, tokenVersion: 3 });
    revoked.request.headers.authorization = `Bearer ${jwt.sign({ sub: String(userId), role: 'user', tv: 2 })}`;
    await expect(revoked.guard.canActivate(revoked.context)).rejects.toThrow('Session has been revoked');

    const deleted = setup(null);
    deleted.request.headers.authorization = `Bearer ${jwt.sign({ sub: String(userId), role: 'user', tv: 2 })}`;
    await expect(deleted.guard.canActivate(deleted.context)).rejects.toThrow('Account no longer exists');
  });
});
