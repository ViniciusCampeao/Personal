import { screen, waitFor } from '@testing-library/react';
import { json, mockFetch, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { renderApp } from '@/test-utils/render';
import { resetAuthStore } from './auth-store';

const TRAINER = {
  accessToken: 'token',
  user: { id: 'u1', tenantId: 't1', name: 'Treinador', email: 't@x.com', role: 'TRAINER' },
};

/** Every screen boots with a refresh attempt; anonymous is the default here. */
function anonymousBoot(fetchMock: FetchMock) {
  fetchMock.on('POST', '/api/v1/auth/refresh', () => problem(401));
}

describe('LoginPage', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = mockFetch();
    resetAuthStore();
    anonymousBoot(fetchMock);
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
  });

  it('validates with the schema shared with the API, in pt-BR', async () => {
    const { user } = renderApp({ route: '/entrar' });
    const submit = await screen.findByRole('button', { name: 'Entrar' });

    await user.click(submit);

    expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
    // Nothing reached the network, since validation ran first.
    expect(fetchMock.callsTo('POST', '/api/v1/auth/login')).toHaveLength(0);
  });

  it('shows the server wording on bad credentials', async () => {
    fetchMock.on('POST', '/api/v1/auth/login', () =>
      problem(401, { detail: 'E-mail ou senha inválidos.' }),
    );
    const { user } = renderApp({ route: '/entrar' });

    await user.type(await screen.findByLabelText('E-mail'), 'ana@x.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeInTheDocument();
  });

  it('explains the rate limit instead of repeating the raw 429', async () => {
    fetchMock.on('POST', '/api/v1/auth/login', () => problem(429));
    const { user } = renderApp({ route: '/entrar' });

    await user.type(await screen.findByLabelText('E-mail'), 'ana@x.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText('Muitas tentativas. Tente novamente em um minuto.'),
    ).toBeInTheDocument();
  });

  it('sends a trainer to the management area after signing in', async () => {
    fetchMock.on('POST', '/api/v1/auth/login', json(TRAINER));
    fetchMock.on(
      'GET',
      '/api/v1/dashboard',
      json({ atRiskStudents: [], workoutsToday: [], recentPRs: [], pendingCheckIns: [] }),
    );
    const { user, router } = renderApp({ route: '/entrar' });

    await user.type(await screen.findByLabelText('E-mail'), 't@x.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/gestao'));
  });

  it('toggles password visibility', async () => {
    const { user } = renderApp({ route: '/entrar' });
    const password = await screen.findByLabelText('Senha');
    expect(password).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(password).toHaveAttribute('type', 'text');
  });
});
