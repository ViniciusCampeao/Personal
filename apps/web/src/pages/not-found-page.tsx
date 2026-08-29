import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { homePathFor, PATHS } from '@/routes/paths';

export function NotFoundPage() {
  const { user } = useAuth();
  const target = user ? homePathFor(user.role) : PATHS.login;

  return (
    <div className="flex flex-col gap-4 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-sm text-text-muted">O endereço acessado não existe ou foi movido.</p>
      <Link to={target} className="text-sm text-accent underline">
        {user ? 'Voltar ao início' : 'Ir para o login'}
      </Link>
    </div>
  );
}
