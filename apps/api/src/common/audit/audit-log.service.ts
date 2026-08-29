import { Inject, Injectable } from '@nestjs/common';
import { TENANT_PRISMA, type TenantPrismaClient } from '../prisma/tenant-prisma.provider';
import { TenantContextService } from '../tenant/tenant-context.service';

/**
 * Spec §10.6: "AuditLog em todo acesso a anamnese, atestado e foto por quem não é o
 * titular." Callers only ever invoke this for a third party's (non-owner's) read of
 * sensitive data — the data subject reading their own record never needs an entry.
 */
@Injectable()
export class AuditLogService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  async recordSensitiveRead(
    actorId: string,
    entity: string,
    entityId: string,
    ip?: string,
  ): Promise<void> {
    await this.db.auditLog.create({
      data: {
        tenantId: this.tenantContext.getTenantId(),
        actorId,
        action: 'READ_SENSITIVE',
        entity,
        entityId,
        isSensitive: true,
        ip,
      },
    });
  }
}
