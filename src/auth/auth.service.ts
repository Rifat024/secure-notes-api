import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SECURITY } from '../config/security.config.js';
import { TooManyAttemptsException } from '../common/exceptions/too-many-attempts.exception.js';
import { Role } from '../common/roles.js';
import { rethrow } from '../common/utils/rethrow.js';
import { securityLog } from '../common/utils/security-log.js';
import { UserDocument } from '../users/schemas/user.schema.js';
import { UsersRepository } from '../users/users.repository.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { LoginGuardService } from './login-guard.service.js';
import { Traced } from '../common/logging/traced.decorator.js';

// Compared against when the email is unknown so response time does not reveal registered accounts.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-password', SECURITY.bcryptRounds);

@Traced()
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly usersRepo: UsersRepository,
    private readonly jwt: JwtService,
    private readonly loginGuard: LoginGuardService,
  ) {}

  signToken(user: Pick<UserDocument, '_id' | 'role' | 'tokenVersion'>): string {
    return this.jwt.sign({ sub: String(user?._id), role: user?.role, tv: user?.tokenVersion ?? 0 });
  }

  private session(user: UserDocument) {
    return { token: this.signToken(user), user: user?.toJSON() };
  }

  async register(dto: RegisterDto) {
    try {
      return this.session(await this.users.create({ ...dto, role: Role.User }));
    } catch (error) {
      rethrow(error, 'AuthService.register');
    }
  }

  async login(dto: LoginDto, ip: string) {
    try {
      await this.loginGuard.assertIpAllowed(ip);
      const user = await this.usersRepo.findForLogin(dto?.email);

      if (user?.lockUntil && user.lockUntil > new Date()) {
        await this.loginGuard.recordIpFailure(ip);
        throw new TooManyAttemptsException(user.lockUntil);
      }

      const valid = await bcrypt.compare(dto?.password ?? '', user?.password ?? DUMMY_HASH);
      if (!user || !valid) {
        await Promise.all([this.loginGuard.recordIpFailure(ip), user && this.loginGuard.recordAccountFailure(user._id)]);
        securityLog('login_failed', { ip, email: dto?.email });
        throw new UnauthorizedException('Invalid email or password');
      }

      await this.loginGuard.resetAccountFailures(user);
      void this.rehashIfCostChanged(user, dto.password);
      return this.session(user);
    } catch (error) {
      rethrow(error, 'AuthService.login');
    }
  }

  /**
   * Re-hashes a password stored at a different bcrypt cost than the configured one. Runs after
   * the response is sent, so it never slows the sign-in, and a failure only means it retries on
   * the next sign-in.
   */
  async rehashIfCostChanged(user: Pick<UserDocument, '_id' | 'password'>, password: string): Promise<void> {
    try {
      if (!user?.password || bcrypt.getRounds(user.password) === SECURITY.bcryptRounds) return;
      await this.usersRepo.replacePasswordHash(user._id, await bcrypt.hash(password, SECURITY.bcryptRounds));
    } catch (error) {
      this.logger.warn(`Password re-hash skipped for ${String(user?._id)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async logout(userId: string): Promise<void> {
    try {
      await this.users.revokeSessions(userId);
    } catch (error) {
      rethrow(error, 'AuthService.logout');
    }
  }

  /** A password change signs out every other session and hands the caller a fresh token. */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    try {
      const { user, sessionsRevoked } = await this.users.updateProfile(userId, dto);
      return sessionsRevoked ? this.session(user) : { user: user?.toJSON() };
    } catch (error) {
      rethrow(error, 'AuthService.updateProfile');
    }
  }
}
