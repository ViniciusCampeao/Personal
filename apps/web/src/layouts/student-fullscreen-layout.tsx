import { Outlet } from 'react-router-dom';
import { useSyncLoop } from '@/features/sync/use-sync';

/**
 * Chrome-free shell for the execution screen (spec §8: one-handed, full-width controls,
 * session progress bar at the top). No header and no bottom nav — everything that is not
 * the current set is a distraction while training.
 */
export function StudentFullscreenLayout() {
  useSyncLoop();

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <Outlet />
    </div>
  );
}
