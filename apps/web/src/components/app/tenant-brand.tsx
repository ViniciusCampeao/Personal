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
    <span className="flex min-w-0 items-center gap-2.5">
      {branding.data?.logoUrl ? (
        <img
          src={branding.data.logoUrl}
          alt=""
          className="size-8 shrink-0 rounded-lg border border-border bg-surface-sunken object-contain p-0.5"
        />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5" fill="currentColor">
            <path d="M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29Z" />
          </svg>
        </span>
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}
