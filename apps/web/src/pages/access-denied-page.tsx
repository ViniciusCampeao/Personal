import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { PATHS } from '@/routes/paths';

/**
 * Where ADMIN lands. The role has no UI by design (spec §2: "Acesso a health check e
 * métricas internas. Não é foco"; §13 puts a tenant admin panel out of scope), and every
 * trainer endpoint is role-gated, so an admin inside `/gestao` would just collect 403s.
 */
export function AccessDeniedPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate(PATHS.login, { replace: true });
  }

  return (
    <div className="flex flex-col gap-4 text-center">
      <h1 className="text-2xl font-semibold">Sem interface para este perfil</h1>
      <p className="text-sm text-text-muted">
        Contas administrativas acessam apenas health check e métricas internas, fora do aplicativo.
      </p>
      <Button variant="secondary" onClick={handleLogout} className="self-center">
        Sair
      </Button>
    </div>
  );
}
