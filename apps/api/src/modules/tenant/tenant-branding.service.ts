import { Inject, Injectable } from '@nestjs/common';
import { type TenantBrandingDto } from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { StorageService } from '../../common/storage/storage.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Injectable()
export class TenantBrandingService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly storage: StorageService,
  ) {}

  async getBranding(): Promise<TenantBrandingDto> {
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: this.tenantContext.getTenantId() },
      select: { name: true, logoKey: true },
    });
    return {
      name: tenant.name,
      logoUrl: tenant.logoKey ? await this.storage.presignGet(tenant.logoKey) : null,
    };
  }
}
