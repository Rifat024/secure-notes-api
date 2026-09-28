import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser, Role } from '../roles';
import { clientIp } from '../utils/client-ip';
import { rethrow } from '../utils/rethrow';
import { securityLog } from '../utils/security-log';

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
