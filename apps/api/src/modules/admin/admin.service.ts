import { Inject, Injectable } from '@nestjs/common';
import {
  type AdminUserDto,
  type ListAuditLogQuery,
  type ListAuditLogResponseDto,
  type TenantDto,
  type UpdateTenantInput,
} from '@pt/shared';
import { TENANT_PRISMA, type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { StorageService } from '../../common/storage/storage.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly db: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
    private readonly storage: StorageService,
  ) {}

  private async toTenantDto(tenant: { id: string; name: string; slug: string; logoKey: string | null }): Promise<TenantDto> {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoKey ? await this.storage.presignGet(tenant.logoKey) : null,
    };
  }

  async getTenant(): Promise<TenantDto> {
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: this.tenantContext.getTenantId() },
    });
    return this.toTenantDto(tenant);
  }

  async updateTenant(input: UpdateTenantInput): Promise<TenantDto> {
    const tenant = await this.db.tenant.update({
      where: { id: this.tenantContext.getTenantId() },
      data: {
        name: input.name,
        ...(input.logoKey !== undefined && { logoKey: input.logoKey }),
      },
    });
    return this.toTenantDto(tenant);
  }

  async listUsers(): Promise<AdminUserDto[]> {
    const rows = await this.db.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listAuditLog(query: ListAuditLogQuery): Promise<ListAuditLogResponseDto> {
    const rows = await this.db.auditLog.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: query.limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      include: { actor: { select: { name: true } } },
    });

    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return {
      items: items.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        actorName: row.actor?.name ?? null,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        isSensitive: row.isSensitive,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }
}
