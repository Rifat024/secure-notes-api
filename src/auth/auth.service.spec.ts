import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { TooManyAttemptsException } from '../common/exceptions/too-many-attempts.exception';
import { hashPassword } from '../users/schemas/user.schema';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginGuardService } from './login-guard.service';

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
      assertIpAllowed: jest.fn().mockResolvedValue(undefined),
      recordIpFailure: jest.fn().mockResolvedValue(undefined),
      recordAccountFailure: jest.fn().mockResolvedValue(undefined),
      resetAccountFailures: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LoginGuardService>;
    repo = { findForLogin: jest.fn() } as unknown as jest.Mocked<UsersRepository>;
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
