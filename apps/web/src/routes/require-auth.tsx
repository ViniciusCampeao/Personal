import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { type AuthenticatedUserDto } from '@pt/shared';
import { useAuth } from '@/features/auth/auth-context';
import { FullPageSpinner } from '@/components/app/full-page-spinner';
import { homePathFor, PATHS } from './paths';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'anonymous') {
    return <Navigate to={PATHS.login} state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

/**
 * A user in the wrong section is sent to their own home rather than shown a 403 — a
 * trainer landing on `/app` simply belongs at `/gestao`.
 */
export function RequireRole({
  allow,
  children,
}: {
  /** Named `allow`, not `role`: on a JSX element `role` means the ARIA role. */
  allow: AuthenticatedUserDto['role'];
  children: ReactNode;
}) {
  const { status, user } = useAuth();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'anonymous' || !user) return <RequireAuth>{children}</RequireAuth>;
  if (user.role !== allow) return <Navigate to={homePathFor(user.role)} replace />;
  return <>{children}</>;
}

/** Keeps a signed-in user off the login and invite screens. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated' && user) return <Navigate to={homePathFor(user.role)} replace />;
  return <>{children}</>;
}
