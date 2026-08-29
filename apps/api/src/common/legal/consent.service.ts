import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConsentType } from '@prisma/client';
import { TENANT_PRISMA, type TenantPrismaClient } from '../prisma/tenant-prisma.provider';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CURRENT_HEALTH_DATA_VERSION, CURRENT_PHOTO_VERSION } from './consent-versions';

const VERSION_BY_TYPE: Record<ConsentType, string> = {
  TERMS: 'v1',
  PRIVACY: 'v1',
  HEALTH_DATA: CURRENT_HEALTH_DATA_VERSION,
  PHOTO: CURRENT_PHOTO_VERSION,
};

const LABEL_BY_TYPE: Record<ConsentType, string> = {
  TERMS: 'os termos de uso',
  PRIVACY: 'a política de privacidade',
  HEALTH_DATA: 'o tratamento de dados de saúde',
  PHOTO: 'o uso de fotos',
};

export interface ConsentContext {
  ip?: string;
  userAgent?: string;
}

/**
 * Spec §10.1: consent for health data and for photos is specific and separate from the
 * Terms acceptance already recorded at invite time (M1). A prior non-revoked `Consent`
 * of the given type satisfies the requirement; otherwise the caller must explicitly
 * accept it in the same request, and that acceptance gets recorded here.
 */
@Injectable()
export class ConsentService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  async requireConsent(
    userId: string,
    type: ConsentType,
    accepted: boolean,
    ctx: ConsentContext,
  ): Promise<void> {
    const existing = await this.db.consent.findFirst({
      where: { userId, type, revokedAt: null },
    });
    if (existing) return;

    if (!accepted) {
      throw new UnprocessableEntityException(
        `É preciso aceitar ${LABEL_BY_TYPE[type]} antes de continuar.`,
      );
    }

    await this.db.consent.create({
      data: {
        tenantId: this.tenantContext.getTenantId(),
        userId,
        type,
        version: VERSION_BY_TYPE[type],
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });
  }
}
