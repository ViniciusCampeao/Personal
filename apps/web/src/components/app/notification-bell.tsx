import { Link } from 'react-router-dom';
import { notificationsPathFor } from '@/routes/paths';
import { useAuth } from '@/features/auth/auth-context';
import { useUnreadNotifications } from '@/features/notifications/use-notifications';

export function NotificationBell() {
  const { user } = useAuth();
  const unread = useUnreadNotifications();
  const count = unread.data?.items.length ?? 0;

  return (
    <Link
      to={notificationsPathFor(user?.role ?? 'STUDENT')}
      className="relative flex size-touch items-center justify-center rounded-lg text-text-muted"
      aria-label={count > 0 ? `Notificações, ${count} não lidas` : 'Notificações'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="currentColor">
        <path d="M12 2a6 6 0 0 0-6 6v3.6l-1.7 3.1A1 1 0 0 0 5.2 16h13.6a1 1 0 0 0 .9-1.3L18 11.6V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z" />
      </svg>
      {count > 0 ? (
        <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-danger-fg">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </Link>
  );
}
