import type {
  AdminUserDto,
  ListAuditLogResponseDto,
  TenantDto,
  UpdateTenantInput,
} from '@pt/shared';
import { apiFetch } from '@/lib/api';

export function fetchTenant(): Promise<TenantDto> {
  return apiFetch<TenantDto>('/admin/tenant');
}

export function updateTenant(input: UpdateTenantInput): Promise<TenantDto> {
  return apiFetch<TenantDto>('/admin/tenant', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function fetchAdminUsers(): Promise<AdminUserDto[]> {
  return apiFetch<AdminUserDto[]>('/admin/users');
}

export function fetchAuditLog(cursor?: string): Promise<ListAuditLogResponseDto> {
  const query = cursor ? `?cursor=${cursor}` : '';
  return apiFetch<ListAuditLogResponseDto>(`/admin/audit-log${query}`);
}
