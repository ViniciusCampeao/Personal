import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TENANT_PRISMA, tenantPrismaFactory } from './tenant-prisma.provider';
import { TenantContextService } from '../tenant/tenant-context.service';

@Global()
@Module({
  providers: [
    PrismaService,
    TenantContextService,
    {
      provide: TENANT_PRISMA,
      useFactory: tenantPrismaFactory,
      inject: [PrismaService, TenantContextService],
    },
  ],
  exports: [PrismaService, TenantContextService, TENANT_PRISMA],
})
export class PrismaModule {}
