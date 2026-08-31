import { z } from 'zod';

export const updateTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** Object key from `POST /media/presign` (kind `tenant-logo`), or `null` to remove it. */
  logoKey: z.string().trim().min(1).max(500).nullable().optional(),
});
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'TRAINER' | 'STUDENT';
  status: string;
  createdAt: string;
}

export const listAuditLogQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  isSensitive: boolean;
  createdAt: string;
}

export interface ListAuditLogResponseDto {
  items: AuditLogDto[];
  nextCursor: string | null;
}
