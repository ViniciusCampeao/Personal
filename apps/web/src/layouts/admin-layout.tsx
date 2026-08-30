import { Outlet } from 'react-router-dom';
import { UserMenu } from '@/components/app/user-menu';

/** A single screen, not a section — no sidebar, no sub-navigation (spec §13 kept this
 * out of scope; this is the "básico" version the user asked for on top of it). */
export function AdminLayout() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur">
        <span className="text-base font-semibold">Administração</span>
        <UserMenu />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
