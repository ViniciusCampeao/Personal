import { Outlet } from 'react-router-dom';

/** Centred column for the screens you can reach signed out: login, invite, legal, 404. */
export function PublicLayout() {
  return (
    <div className="flex min-h-full flex-col items-center px-4 pt-16 pb-10 sm:pt-24">
      <main className="w-full max-w-sm">
        <Outlet />
      </main>
    </div>
  );
}
