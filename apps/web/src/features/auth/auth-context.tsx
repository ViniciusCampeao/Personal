import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type AuthenticatedUserDto, type LoginInput, type LoginResponseDto } from '@pt/shared';
import { clearLocalData } from '@/lib/db';
import { flushOutbox } from '@/features/sync/sync-engine';
import * as authApi from './auth-api';
import { clearSession, refreshSession, setAccessToken, setSessionListener } from './auth-store';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: AuthenticatedUserDto | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<AuthenticatedUserDto>;
  adoptSession: (session: LoginResponseDto) => AuthenticatedUserDto;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the session for the UI. The token itself stays in `auth-store`; this only mirrors
 * the user so components can render — no component ever reads the raw token.
 *
 * Must sit inside `QueryClientProvider`: logging out has to clear the query cache, or the
 * next user on the same device sees the previous one's data.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthenticatedUserDto | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Keep the store and the React mirror in sync, including refreshes triggered from
  // inside `apiFetch` (which knows nothing about React).
  useEffect(() => {
    setSessionListener((session) => {
      setUser(session?.user ?? null);
      setStatus(session ? 'authenticated' : 'anonymous');
    });
    return () => setSessionListener(() => {});
  }, []);

  // Restore the session on boot. The refresh response already carries the user, so there
  // is no need for a follow-up `/auth/me`.
  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((token) => {
      if (cancelled) return;
      if (!token) setStatus('anonymous');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const adoptSession = useCallback((session: LoginResponseDto): AuthenticatedUserDto => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const login = useCallback(
    async (input: LoginInput) => adoptSession(await authApi.login(input)),
    [adoptSession],
  );

  const logout = useCallback(async () => {
    // Last chance to deliver the offline queue: the local database is wiped below,
    // because the next person to sign in on this device must not find it.
    try {
      await flushOutbox();
    } catch {
      // Nothing to do — `hasPendingWork` is what warns the user before they get here.
    }
    try {
      await authApi.logout();
    } catch {
      // Already invalid server-side; the local teardown below is what matters.
    }
    await clearLocalData();
    // Goes through the store so the listener above moves the UI to anonymous.
    clearSession();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, status, login, adoptSession, logout }),
    [user, status, login, adoptSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}
