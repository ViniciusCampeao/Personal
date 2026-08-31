import { useQuery } from '@tanstack/react-query';
import { fetchTenantBranding } from '@/features/tenant/tenant-api';

const REFRESH_MS = 4 * 60 * 1000; // logoUrl is a short-lived presigned URL — keep it fresh

/**
 * App-shell brand mark (sidebar/header): the tenant's own logo + name in place of the
 * generic "Treino" label, so a trainer's students see their trainer's brand, not ours.
 * Falls back to "Treino" while loading or when no logo/name is set.
 */
export function TenantBrand() {
  const branding = useQuery({
    queryKey: ['tenant', 'branding'],
    queryFn: fetchTenantBranding,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
  });

  const name = branding.data?.name || 'Treino';

  return (
    <span className="flex min-w-0 items-center gap-2">
      {branding.data?.logoUrl ? (
        <img
          src={branding.data.logoUrl}
          alt=""
          className="size-7 shrink-0 rounded-md object-contain"
        />
      ) : null}
      <span className="truncate">{name}</span>
    </span>
  );
}
