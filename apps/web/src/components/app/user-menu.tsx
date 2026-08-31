import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { PATHS } from '@/routes/paths';

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate(PATHS.login, { replace: true });
  }

  return (
    <div className="flex items-center gap-3">
      {user ? (
        // Only the trainer has a profile screen of their own today (spec follow-up:
        // that's also where they edit their brand) — an admin manages everything from
        // this page already, so their name isn't a link.
        user.role === 'TRAINER' ? (
          <Link
            to={PATHS.trainerProfile}
            className="hidden rounded text-sm text-text-muted hover:text-text hover:underline sm:inline"
          >
            {user.name}
          </Link>
        ) : (
          <span className="hidden text-sm text-text-muted sm:inline">{user.name}</span>
        )
      ) : null}
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Sair
      </Button>
    </div>
  );
}
