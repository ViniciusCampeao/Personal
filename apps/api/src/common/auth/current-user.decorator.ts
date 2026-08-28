import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type RequestUser, type RequestWithUser } from './types';

/** Injects `request.user`, set by `TenantMiddleware` from the verified access token. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    return ctx.switchToHttp().getRequest<RequestWithUser>().user;
  },
);
