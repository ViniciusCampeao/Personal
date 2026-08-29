import { useNavigate } from 'react-router-dom';
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
      {user ? <span className="hidden text-sm text-text-muted sm:inline">{user.name}</span> : null}
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Sair
      </Button>
    </div>
  );
}
