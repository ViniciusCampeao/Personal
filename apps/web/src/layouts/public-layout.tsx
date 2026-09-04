import { Outlet } from 'react-router-dom';
import { BRAND } from '@/lib/brand';

/**
 * Centred column for the screens you can reach signed out: login, invite, legal, 404.
 *
 * The badge is the whole brand statement here — it already carries the name and the
 * tagline in its ring, so nothing repeats them underneath; the page's own heading gets to
 * lead instead. `rounded-full` clips the disc so the browser anti-aliases its edge.
 */
export function PublicLayout() {
  return (
    <div className="flex min-h-full flex-col items-center px-4 pt-12 pb-10 sm:pt-16">
      <main className="flex w-full max-w-sm flex-col gap-8">
        <img
          src={BRAND.logo}
          alt={BRAND.legalName}
          className="mx-auto size-32 rounded-full sm:size-36"
        />
        <Outlet />
      </main>
    </div>
  );
}
