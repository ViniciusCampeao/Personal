import { useQuery } from '@tanstack/react-query';
import { fetchTenantBranding } from '@/features/tenant/tenant-api';
import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/cn';

const REFRESH_MS = 4 * 60 * 1000; // logoUrl is a short-lived presigned URL — keep it fresh

/**
 * App-shell brand mark (sidebar/header): the tenant's own logo + name, falling back to
 * the app's own brand while that loads or when the tenant has set neither.
 *
 * The mark is clipped to a circle: both brand assets are discs drawn edge to edge, and an
 * uploaded logo is usually square with its own padding, so a circle is the one shape that
 * flatters both. `rounded-full` on the element also hands the anti-aliasing of that edge
 * to the browser, which the indexed PNGs cannot do themselves.
 */
export function TenantBrand({ className }: { className?: string }) {
  const branding = useQuery({
    queryKey: ['tenant', 'branding'],
    queryFn: fetchTenantBranding,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
  });

  const name = branding.data?.name || BRAND.name;

  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <img
        src={branding.data?.logoUrl || BRAND.logoMark}
        alt=""
        className="size-9 shrink-0 rounded-full border border-border bg-surface-sunken object-cover"
      />
      <span className="truncate font-semibold">{name}</span>
    </span>
  );
}
