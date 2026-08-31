import type { TenantBrandingDto } from '@pt/shared';
import { apiFetch } from '@/lib/api';

/** Available to any authenticated role — see `TenantBrandingController`. */
export function fetchTenantBranding(): Promise<TenantBrandingDto> {
  return apiFetch<TenantBrandingDto>('/tenant/branding');
}
