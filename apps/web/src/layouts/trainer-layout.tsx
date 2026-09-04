import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { NotificationBell } from '@/components/app/notification-bell';
import { SyncIndicator } from '@/components/app/sync-indicator';
import { TenantBrand } from '@/components/app/tenant-brand';
import { UserMenu } from '@/components/app/user-menu';
import { PATHS } from '@/routes/paths';

const ITEMS = [
  { to: PATHS.trainerHome, label: 'Dashboard', end: true },
  { to: PATHS.trainerStudents, label: 'Alunos', end: false },
  { to: PATHS.trainerAgenda, label: 'Agenda', end: false },
  { to: PATHS.trainerLibrary, label: 'Biblioteca', end: false },
  { to: PATHS.trainerTemplates, label: 'Templates', end: false },
  { to: PATHS.trainerProfile, label: 'Perfil', end: false },
] as const;

/** Desktop-first shell (spec §8), still usable narrow — the sidebar becomes a drawer. */
export function TrainerLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Navigating is the end of the drawer's job; leaving it open would cover the page
  // the trainer just asked for.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-full">
      <Sidebar className="hidden w-64 shrink-0 border-r border-border bg-surface-raised lg:block" />

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <Sidebar className="w-64 border-r border-border bg-surface-raised" />
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
            className="flex-1 bg-black/60"
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={drawerOpen}
            className="flex size-touch items-center justify-center rounded-field text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text lg:hidden"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="currentColor">
              <path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" />
            </svg>
          </button>
          <div className="flex flex-1 items-center justify-end gap-2">
            <SyncIndicator />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={className}>
      <div className="flex min-h-16 items-center border-b border-border px-4">
        <TenantBrand />
      </div>
      <nav aria-label="Navegação principal" className="px-2 py-2">
        <ul className="flex flex-col gap-1">
          {ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    // The active item keeps a bar on its inner edge: on a ground this
                    // dark a tint alone is nearly invisible at a glance.
                    'flex min-h-touch items-center rounded-field border-l-2 px-3 text-sm transition-colors',
                    isActive
                      ? 'border-accent bg-accent/10 font-medium text-accent'
                      : 'border-transparent text-text-muted hover:bg-white/[0.04] hover:text-text',
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
