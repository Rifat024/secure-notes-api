import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SECURITY } from '../config/security.config';
import { TooManyAttemptsException } from '../common/exceptions/too-many-attempts.exception';
import { Role } from '../common/roles';
import { rethrow } from '../common/utils/rethrow';
import { securityLog } from '../common/utils/security-log';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LoginGuardService } from './login-guard.service';
import { Traced } from '../common/logging/traced.decorator';

// Compared against when the email is unknown so response time does not reveal registered accounts.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-password', SECURITY.bcryptRounds);

@Traced()
@Injectable()
export class AuthService {
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
      return this.session(user);
    } catch (error) {
      rethrow(error, 'AuthService.login');
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
