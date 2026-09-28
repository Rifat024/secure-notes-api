import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SECURITY } from '../../config/security.config.js';
import { UsersRepository } from '../../users/users.repository.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { rethrow } from '../utils/rethrow.js';

export interface JwtPayload {
  sub: string;
  role: string;
  tv: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
      if (isPublic) return true;

      const request = context.switchToHttp().getRequest();
      const [scheme, token] = String(request?.headers?.authorization ?? '').split(' ');
      if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Authentication required');

      const payload = await this.verify(token);

      // Role and token version are re-read so demotion, deletion, and logout take effect immediately.
      const user = await this.users.findSessionUser(payload?.sub);
      if (!user) throw new UnauthorizedException('Account no longer exists');
      if ((user?.tokenVersion ?? 0) !== (payload?.tv ?? 0)) throw new UnauthorizedException('Session has been revoked');

      request.user = { id: String(user._id), role: user?.role, name: user?.name, email: user?.email };
      return true;
    } catch (error) {
      rethrow(error, 'JwtAuthGuard.canActivate');
    }
  }

  private async verify(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, {
        algorithms: ['HS256'],
        issuer: SECURITY.jwtIssuer,
        audience: SECURITY.jwtAudience,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
