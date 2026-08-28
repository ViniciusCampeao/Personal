import { PrismaService } from './prisma.service';
import { tenantExtension } from './tenant-scope';
import { TenantContextService } from '../tenant/tenant-context.service';

export const TENANT_PRISMA = Symbol('TENANT_PRISMA');

export function tenantPrismaFactory(prisma: PrismaService, tenantContext: TenantContextService) {
  return prisma.$extends(tenantExtension(tenantContext));
}

/**
 * The client every feature module should inject: same connection as `PrismaService`,
 * but every call to a tenant-scoped model automatically carries the current tenant's
 * filter (see `common/prisma/tenant-scope.ts`). `PrismaService` itself stays available
 * unextended for the health check and for the couple of genuinely cross-tenant lookups
 * that call `TenantContextService.runUnscoped()` explicitly.
 */
export type TenantPrismaClient = ReturnType<typeof tenantPrismaFactory>;
