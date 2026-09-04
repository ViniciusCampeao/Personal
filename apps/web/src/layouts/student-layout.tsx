import { Outlet } from 'react-router-dom';
import { BottomNav } from '@/components/app/bottom-nav';
import { NotificationBell } from '@/components/app/notification-bell';
import { SyncIndicator } from '@/components/app/sync-indicator';
import { TenantBrand } from '@/components/app/tenant-brand';
import { useSyncLoop } from '@/features/sync/use-sync';

/** Mobile-first shell (spec §8: "é onde o app é usado de verdade"). */
export function StudentLayout() {
  // The queue drains from wherever the student happens to be, not only on the workout
  // screen — a set logged in the gym can well be delivered while they browse history.
  useSyncLoop();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur">
        <TenantBrand className="min-w-0" />
        <div className="flex items-center gap-2">
          <SyncIndicator />
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
