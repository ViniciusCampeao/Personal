import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type NextFunction, type Response } from 'express';
import { type Env } from '../../config/env';
import { type AccessTokenPayload, type RequestWithUser } from '../auth/types';
import { TenantContextService } from './tenant-context.service';

/**
 * Runs first on every request. If a valid access token is present, decodes it, attaches
 * `req.user`, and binds the tenant for the rest of the request's async lifetime — every
 * Prisma call downstream (guards, services) automatically inherits it via
 * `TenantContextService` / the extension in `common/prisma/tenant-scope.ts`.
 *
 * No token, or an invalid/expired one, is NOT an error here: the request proceeds
 * unscoped, and `JwtAccessGuard` is what actually rejects it for routes that require
 * auth. That keeps public routes (login, invite lookup, health) working without a
 * separate code path.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async use(req: RequestWithUser, _res: Response, next: NextFunction): Promise<void> {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    if (!token) {
      return this.tenantContext.runUnscoped(() => next());
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      req.user = {
        id: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
        email: payload.email,
      };
      return this.tenantContext.run(
        { tenantId: payload.tenantId, userId: payload.sub, role: payload.role },
        () => next(),
      );
    } catch (error) {
      this.logger.debug(`Rejected access token: ${(error as Error).message}`);
      return this.tenantContext.runUnscoped(() => next());
    }
  }
}
