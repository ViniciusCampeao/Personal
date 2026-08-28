import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import {
  type AcceptInviteInput,
  type AuthenticatedUserDto,
  type InvitePreviewDto,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../../common/legal/consent-versions';
import { hashPassword } from '../../common/auth/password';
import { TokenService } from '../../common/auth/token.service';
import { readEnv, type Env } from '../../config/env';
import { type IssuedSession } from '../auth/auth.service';

const INVITE_TOKEN_BYTES = 24;

export interface CreatedInvite {
  id: string;
  token: string;
  url: string;
  qrCodeDataUrl: string;
  expiresAt: Date;
}

export interface AcceptInviteContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class InvitesService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async create(
    trainerId: string,
    input: { email?: string; phone?: string; expiresInDays: number },
  ): Promise<CreatedInvite> {
    const token = randomBytes(INVITE_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

    // The tenant extension overrides tenantId at runtime regardless, but Prisma's
    // generated CreateInput type still requires the field — pass the real value
    // explicitly rather than fighting the type with `as any`.
    const invite = await this.db.invite.create({
      data: {
        tenantId: this.tenantContext.getTenantId(),
        trainerId,
        email: input.email ?? null,
        phone: input.phone ?? null,
        token,
        expiresAt,
      },
    });

    const env = readEnv(this.config);
    const url = `${env.PUBLIC_APP_URL}/convite/${token}`;
    const qrCodeDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });

    return { id: invite.id, token, url, qrCodeDataUrl, expiresAt };
  }

  /** Public lookup, deliberately cross-tenant — see `TenantContextService.runUnscoped`. */
  async preview(token: string): Promise<InvitePreviewDto> {
    const invite = await this.tenantContext.runUnscoped(() =>
      this.db.invite.findFirst({
        where: { token },
        include: { trainer: { include: { tenant: true } } },
      }),
    );
    if (!invite) throw new NotFoundException('Convite não encontrado.');
    if (invite.acceptedAt) throw new GoneException('Este convite já foi utilizado.');
    if (invite.expiresAt < new Date()) throw new GoneException('Este convite expirou.');

    return {
      trainerName: invite.trainer.name,
      tenantName: invite.trainer.tenant.name,
      email: invite.email,
      phone: invite.phone,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async accept(
    token: string,
    input: AcceptInviteInput,
    context: AcceptInviteContext,
  ): Promise<IssuedSession> {
    const invite = await this.tenantContext.runUnscoped(() =>
      this.db.invite.findFirst({ where: { token } }),
    );
    if (!invite) throw new NotFoundException('Convite não encontrado.');
    if (invite.acceptedAt) throw new GoneException('Este convite já foi utilizado.');
    if (invite.expiresAt < new Date()) throw new GoneException('Este convite expirou.');

    const email = invite.email ?? input.email;
    if (!email) throw new ConflictException('Informe um e-mail para concluir o cadastro.');

    return this.tenantContext.run({ tenantId: invite.tenantId }, async () => {
      const existing = await this.db.user.findUnique({
        where: { tenantId_email: { tenantId: invite.tenantId, email } },
      });
      if (existing) throw new ConflictException('Já existe uma conta com este e-mail.');

      const passwordHash = await hashPassword(input.password);
      const now = new Date();

      const user = await this.db.user.create({
        data: {
          tenantId: invite.tenantId,
          email,
          name: input.name,
          phone: input.phone ?? invite.phone,
          role: 'STUDENT',
          status: 'ACTIVE',
          passwordHash,
          lastLoginAt: now,
          studentProfile: {
            create: { tenantId: invite.tenantId, trainerId: invite.trainerId },
          },
          // NOTE: nested writes (this `consents.createMany`, and `studentProfile.create`
          // above) are NOT seen by the tenant-scope Prisma extension — it only
          // intercepts the top-level `user.create` call, not writes to other models
          // composed inside the same query. Every tenant-scoped nested object here must
          // carry `tenantId` by hand.
          consents: {
            createMany: {
              data: [
                {
                  tenantId: invite.tenantId,
                  type: 'TERMS',
                  version: CURRENT_TERMS_VERSION,
                  ip: context.ip,
                  userAgent: context.userAgent,
                },
                {
                  tenantId: invite.tenantId,
                  type: 'PRIVACY',
                  version: CURRENT_PRIVACY_VERSION,
                  ip: context.ip,
                  userAgent: context.userAgent,
                },
              ],
            },
          },
        },
      });

      await this.db.invite.update({ where: { id: invite.id }, data: { acceptedAt: now } });

      const accessToken = this.tokens.signAccessToken(user);
      const refreshToken = await this.tokens.issueRefreshToken(user);
      const userDto: AuthenticatedUserDto = {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        role: user.role,
      };
      return {
        accessToken,
        refreshToken,
        refreshMaxAgeMs: this.tokens.refreshCookieMaxAgeMs,
        user: userDto,
      };
    });
  }
}
