import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { TenantMiddleware } from '../tenant/tenant.middleware';

/**
 * Infrastructure shared by every auth-aware part of the app: the JWT signer (secrets are
 * passed per-call by `TokenService`, so no default is configured here), token issuance
 * and the request-level middleware that binds tenant context. `@Global` so feature
 * modules never need to re-import it, matching `PrismaModule`.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [TokenService, TenantMiddleware],
  exports: [JwtModule, TokenService, TenantMiddleware],
})
export class AuthCommonModule {}
