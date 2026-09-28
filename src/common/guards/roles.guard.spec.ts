import { jest } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../roles.js';
import { RolesGuard } from './roles.guard.js';

const contextFor = (user?: { role: Role }) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user, headers: {}, url: '/api/admin/users' }) }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const reflector = new Reflector();

  it('allows routes without role metadata', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(new RolesGuard(reflector).canActivate(contextFor({ role: Role.User }))).toBe(true);
  });

  it('allows admins on admin routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.Admin]);
    expect(new RolesGuard(reflector).canActivate(contextFor({ role: Role.Admin }))).toBe(true);
  });

  it('rejects users and anonymous callers with 403', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.Admin]);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextFor({ role: Role.User }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });
});
