import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { type RequestWithUser } from './types';

/**
 * Registered globally (see AppModule). Does not verify the JWT itself — `TenantMiddleware`
 * already did that for every request and attached `request.user` on success. This guard
 * just enforces "does this route need it", via `@Public()`.
 */
@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new UnauthorizedException('Autenticação necessária.');
    }
    return true;
  }
}
