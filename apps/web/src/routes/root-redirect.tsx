import { Navigate } from 'react-router-dom';
import { FullPageSpinner } from '@/components/app/full-page-spinner';
import { useAuth } from '@/features/auth/auth-context';
import { homePathFor, PATHS } from './paths';

/** `/` resolves to whichever home the signed-in role owns, or to the login screen. */
export function RootRedirect() {
  const { status, user } = useAuth();

  if (status === 'loading') return <FullPageSpinner />;

  return <Navigate to={user ? homePathFor(user.role) : PATHS.login} replace />;
}
