import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { type RequestWithUser } from './types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user || !required.includes(request.user.role)) {
      throw new ForbiddenException('Você não tem permissão para acessar este recurso.');
    }
    return true;
  }
}
