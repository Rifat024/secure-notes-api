import { jest } from '@jest/globals';

import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { TooManyAttemptsException } from '../common/exceptions/too-many-attempts.exception.js';
import { hashPassword } from '../users/schemas/user.schema.js';
import { UsersRepository } from '../users/users.repository.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { LoginGuardService } from './login-guard.service.js';

type AnyFn = (...args: any[]) => any;

describe('AuthService.login', () => {
  const ip = '203.0.113.9';
  let guard: jest.Mocked<LoginGuardService>;
  let repo: jest.Mocked<UsersRepository>;
  let service: AuthService;
  let user: Record<string, any>;

  beforeAll(async () => {
    user = { _id: new Types.ObjectId(), role: 'user', tokenVersion: 0, password: await hashPassword('Password123'), toJSON: () => ({ name: 'Ada' }) };
  });

  beforeEach(() => {
    guard = {
      assertIpAllowed: jest.fn<AnyFn>().mockResolvedValue(undefined),
      recordIpFailure: jest.fn<AnyFn>().mockResolvedValue(undefined),
      recordAccountFailure: jest.fn<AnyFn>().mockResolvedValue(undefined),
      resetAccountFailures: jest.fn<AnyFn>().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LoginGuardService>;
    repo = { findForLogin: jest.fn<AnyFn>() } as unknown as jest.Mocked<UsersRepository>;
    service = new AuthService({} as UsersService, repo, new JwtService({ secret: 'unit-test-secret' }), guard);
  });

  it('issues a token and resets counters on success', async () => {
    repo.findForLogin.mockResolvedValue({ ...user, lockUntil: undefined } as never);
    const result = await service.login({ email: 'ada@example.com', password: 'Password123' }, ip);
    expect(result?.token).toEqual(expect.any(String));
    expect(guard.resetAccountFailures).toHaveBeenCalled();
  });

  it('records IP and account failures on a wrong password', async () => {
    repo.findForLogin.mockResolvedValue({ ...user } as never);
    await expect(service.login({ email: 'ada@example.com', password: 'wrong-pass1' }, ip)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(guard.recordIpFailure).toHaveBeenCalledWith(ip);
    expect(guard.recordAccountFailure).toHaveBeenCalledWith(user._id);
  });

  it('treats unknown emails exactly like wrong passwords', async () => {
    repo.findForLogin.mockResolvedValue(null);
    await expect(service.login({ email: 'ghost@example.com', password: 'Password123' }, ip)).rejects.toThrow('Invalid email or password');
    expect(guard.recordIpFailure).toHaveBeenCalledWith(ip);
    expect(guard.recordAccountFailure).not.toHaveBeenCalled();
  });

  it('refuses a locked account even with the right password', async () => {
    repo.findForLogin.mockResolvedValue({ ...user, lockUntil: new Date(Date.now() + 60_000) } as never);
    await expect(service.login({ email: 'ada@example.com', password: 'Password123' }, ip)).rejects.toBeInstanceOf(TooManyAttemptsException);
    expect(guard.resetAccountFailures).not.toHaveBeenCalled();
  });

  it('refuses a blocked IP before touching the account', async () => {
    guard.assertIpAllowed.mockRejectedValue(new TooManyAttemptsException(new Date(Date.now() + 60_000)));
    await expect(service.login({ email: 'ada@example.com', password: 'Password123' }, ip)).rejects.toBeInstanceOf(TooManyAttemptsException);
    expect(repo.findForLogin).not.toHaveBeenCalled();
  });
});

describe('AuthService.rehashIfCostChanged', () => {
  const makeService = (repo: Partial<UsersRepository>) =>
    new AuthService({} as UsersService, repo as UsersRepository, new JwtService({ secret: 'unit-test-secret' }), {} as LoginGuardService);

  it('re-hashes a password stored at a different cost', async () => {
    const replacePasswordHash = jest.fn<UsersRepository['replacePasswordHash']>().mockResolvedValue(undefined);
    const user = { _id: new Types.ObjectId(), password: await bcrypt.hash('Password123', 11) };
    await makeService({ replacePasswordHash }).rehashIfCostChanged(user, 'Password123');
    expect(replacePasswordHash).toHaveBeenCalledTimes(1);
    const [, newHash] = replacePasswordHash.mock.calls[0];
    expect(bcrypt.getRounds(newHash)).toBe(12);
    expect(await bcrypt.compare('Password123', newHash)).toBe(true);
  });

  it('leaves a password already at the configured cost untouched', async () => {
    const replacePasswordHash = jest.fn<UsersRepository['replacePasswordHash']>();
    const user = { _id: new Types.ObjectId(), password: await hashPassword('Password123') };
    await makeService({ replacePasswordHash }).rehashIfCostChanged(user, 'Password123');
    expect(replacePasswordHash).not.toHaveBeenCalled();
  });

  it('never throws when the update fails', async () => {
    const replacePasswordHash = jest.fn<UsersRepository['replacePasswordHash']>().mockRejectedValue(new Error('db down'));
    const user = { _id: new Types.ObjectId(), password: await bcrypt.hash('Password123', 11) };
    await expect(makeService({ replacePasswordHash }).rehashIfCostChanged(user, 'Password123')).resolves.toBeUndefined();
  });
});
