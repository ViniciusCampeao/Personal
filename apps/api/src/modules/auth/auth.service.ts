import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { type User } from '@prisma/client';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { TokenService } from '../../common/auth/token.service';
import { hashPassword, verifyPassword } from '../../common/auth/password';
import { type AuthenticatedUserDto } from '@pt/shared';

const GENERIC_LOGIN_ERROR = 'E-mail ou senha inválidos.';

function toDto(user: User): AuthenticatedUserDto {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshMaxAgeMs: number;
  user: AuthenticatedUserDto;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly tokens: TokenService,
  ) {}

  async login(email: string, password: string): Promise<IssuedSession> {
    // Login happens before we know which tenant we're in — `email` is only unique
    // *within* a tenant (`@@unique([tenantId, email])`), not globally. Forced unscoped
    // regardless of ambient context so behaviour never depends on a stray header.
    const candidates = await this.tenantContext.runUnscoped(() =>
      this.db.user.findMany({ where: { email, deletedAt: null } }),
    );

    // More than one tenant sharing this e-mail is a real possibility once this becomes
    // multi-tenant SaaS (spec §0). Resolving it needs a "choose your workspace" step
    // that doesn't exist yet — until then, refuse rather than guess which account to log
    // into.
    if (candidates.length !== 1) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const user = candidates[0]!;
    const passwordOk =
      user.passwordHash != null && (await verifyPassword(user.passwordHash, password));
    if (!passwordOk) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Conta inativa. Fale com seu personal trainer.');
    }

    return this.tenantContext.run(
      { tenantId: user.tenantId, userId: user.id, role: user.role },
      async () => {
        await this.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return this.issueSession(user);
      },
    );
  }

  async refresh(refreshToken: string): Promise<IssuedSession> {
    const payload = await this.tokens.verifyAndConsumeRefreshToken(refreshToken);

    return this.tenantContext.run({ tenantId: payload.tenantId, userId: payload.sub }, async () => {
      const user = await this.db.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.deletedAt || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Sessão inválida.');
      }
      return this.issueSession(user);
    });
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const payload = this.tokens.decodeRefreshToken(refreshToken);
    if (payload) await this.tokens.revokeRefreshToken(payload.sub, payload.jti);
  }

  async me(userId: string): Promise<AuthenticatedUserDto> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Sessão inválida.');
    }
    return toDto(user);
  }

  async hashPassword(plain: string): Promise<string> {
    return hashPassword(plain);
  }

  private async issueSession(user: User): Promise<IssuedSession> {
    const accessToken = this.tokens.signAccessToken(user);
    const refreshToken = await this.tokens.issueRefreshToken(user);
    return {
      accessToken,
      refreshToken,
      refreshMaxAgeMs: this.tokens.refreshCookieMaxAgeMs,
      user: toDto(user),
    };
  }
}
