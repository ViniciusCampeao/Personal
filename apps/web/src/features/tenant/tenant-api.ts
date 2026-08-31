import type { TenantBrandingDto, TenantDto, UpdateTenantInput } from '@pt/shared';
import { apiFetch } from '@/lib/api';

/** Available to any authenticated role — see `TenantBrandingController`. */
export function fetchTenantBranding(): Promise<TenantBrandingDto> {
  return apiFetch<TenantBrandingDto>('/tenant/branding');
}

/**
 * Read/write the full tenant record (name + logo). Route lives under `/admin` for
 * historical reasons, but `GET`/`PATCH` are open to TRAINER as well as ADMIN — see
 * `AdminController` — because branding is something the trainer owns day-to-day, not
 * only the tenant's admin.
 */
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
