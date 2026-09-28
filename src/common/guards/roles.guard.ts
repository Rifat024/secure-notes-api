import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { AuthUser, Role } from '../roles.js';
import { clientIp } from '../utils/client-ip.js';
import { rethrow } from '../utils/rethrow.js';
import { securityLog } from '../utils/security-log.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
      if (!required?.length) return true;

      const request = context.switchToHttp().getRequest();
      const user: AuthUser | undefined = request?.user;
      if (user?.role && required.includes(user.role)) return true;

      securityLog('forbidden', { userId: user?.id, ip: clientIp(request), path: request?.url });
      throw new ForbiddenException('Insufficient permissions');
    } catch (error) {
      rethrow(error, 'RolesGuard.canActivate');
    }
  }
}
