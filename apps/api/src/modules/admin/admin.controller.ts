import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  listAuditLogQuerySchema,
  updateTenantSchema,
  type AdminUserDto,
  type ListAuditLogQuery,
  type ListAuditLogResponseDto,
  type TenantDto,
  type UpdateTenantInput,
} from '@pt/shared';
import { Roles } from '../../common/auth/roles.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { AdminService } from './admin.service';

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('tenant')
  getTenant(): Promise<TenantDto> {
    return this.admin.getTenant();
  }

  @Patch('tenant')
  updateTenant(
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput,
  ): Promise<TenantDto> {
    return this.admin.updateTenant(body);
  }

  @Get('users')
  listUsers(): Promise<AdminUserDto[]> {
    return this.admin.listUsers();
  }

  @Get('audit-log')
  listAuditLog(
    @Query(new ZodValidationPipe(listAuditLogQuerySchema)) query: ListAuditLogQuery,
  ): Promise<ListAuditLogResponseDto> {
    return this.admin.listAuditLog(query);
  }
}
