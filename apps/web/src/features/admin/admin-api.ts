import type { AdminUserDto, ListAuditLogResponseDto } from '@pt/shared';
import { apiFetch } from '@/lib/api';

// Branding (name/logo) moved to `features/tenant/tenant-api.ts`: it's no longer
// admin-exclusive, a trainer edits it from their own profile too — see `TenantBrandingCard`.

export function fetchAdminUsers(): Promise<AdminUserDto[]> {
  return apiFetch<AdminUserDto[]>('/admin/users');
}

export function fetchAuditLog(cursor?: string): Promise<ListAuditLogResponseDto> {
  const query = cursor ? `?cursor=${cursor}` : '';
  return apiFetch<ListAuditLogResponseDto>(`/admin/audit-log${query}`);
}
