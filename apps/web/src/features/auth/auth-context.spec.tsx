import { screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { json, mockFetch, noContent, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { renderScreen } from '@/test-utils/render';
import { useAuth } from './auth-context';
import { resetAuthStore } from './auth-store';

const SESSION = {
  accessToken: 'token',
  user: { id: 'u1', tenantId: 't1', name: 'Ana', email: 'ana@x.com', role: 'STUDENT' },
};

function Probe() {
  const { status, user, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user?.name ?? 'ninguém'}</p>
      <button onClick={() => void logout()}>Sair</button>
    </div>
  );
}

/** Any authenticated query — used to prove `apiFetch` reports a dead session upwards. */
function ProtectedProbe() {
  useQuery({ queryKey: ['protected'], queryFn: () => apiFetch('/anything'), retry: false });
  return <Probe />;
}

describe('AuthProvider', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = mockFetch();
    resetAuthStore();
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
  });

  it('restores the session on boot without a follow-up /auth/me', async () => {
    fetchMock.on('POST', '/api/v1/auth/refresh', json(SESSION));
    renderScreen(<Probe />);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('Ana');
    // The refresh response already carries the user, so asking again would be a wasted
    // round-trip on every single page load.
    expect(fetchMock.callsTo('GET', '/api/v1/auth/me')).toHaveLength(0);
  });

  it('settles as anonymous when there is no refresh cookie', async () => {
    fetchMock.on('POST', '/api/v1/auth/refresh', () => problem(401));
    renderScreen(<Probe />);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('user')).toHaveTextContent('ninguém');
  });

  it('drops the previous user cache on logout', async () => {
    fetchMock.on('POST', '/api/v1/auth/refresh', json(SESSION));
    fetchMock.on('POST', '/api/v1/auth/logout', noContent());
    const { user, queryClient } = renderScreen(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    queryClient.setQueryData(['sessions'], ['treino da Ana']);
    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    // Otherwise the next person on this device sees the previous one's data.
    expect(queryClient.getQueryData(['sessions'])).toBeUndefined();
  });

  it('signs the user out locally even when the logout call fails', async () => {
    fetchMock.on('POST', '/api/v1/auth/refresh', json(SESSION));
    fetchMock.on('POST', '/api/v1/auth/logout', () => problem(401));
    const { user } = renderScreen(<Probe />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
  });

  it('goes anonymous when a request 401s and the session cannot be refreshed', async () => {
    let refreshes = 0;
    fetchMock.on('POST', '/api/v1/auth/refresh', () =>
      refreshes++ === 0 ? json(SESSION) : problem(401),
    );
    fetchMock.on('GET', '/api/v1/anything', () => problem(401));
    renderScreen(<ProtectedProbe />);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
  });
});
