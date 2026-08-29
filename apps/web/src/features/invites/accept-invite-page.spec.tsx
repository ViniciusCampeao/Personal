import { screen, waitFor } from '@testing-library/react';
import { json, mockFetch, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { renderApp } from '@/test-utils/render';
import { resetAuthStore } from '@/features/auth/auth-store';

const TOKEN = 'abc123';
const INVITE_URL = `/api/v1/invites/${TOKEN}`;

const PREVIEW = {
  trainerName: 'Treinador Silva',
  tenantName: 'Studio X',
  email: 'ana@x.com',
  phone: null,
  expiresAt: '2026-09-05T12:00:00Z',
};

describe('AcceptInvitePage', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = mockFetch();
    resetAuthStore();
    fetchMock.on('POST', '/api/v1/auth/refresh', () => problem(401));
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
  });

  it('introduces the trainer and the studio', async () => {
    fetchMock.on('GET', INVITE_URL, json(PREVIEW));
    renderApp({ route: `/convite/${TOKEN}` });

    expect(
      await screen.findByText('Treinador Silva convidou você para treinar na Studio X.'),
    ).toBeInTheDocument();
  });

  it('shows the server wording for a spent invite instead of inventing its own', async () => {
    fetchMock.on('GET', INVITE_URL, () =>
      problem(410, { detail: 'Este convite já foi utilizado.' }),
    );
    renderApp({ route: `/convite/${TOKEN}` });

    expect(await screen.findByText('Este convite já foi utilizado.')).toBeInTheDocument();
  });

  it('locks the e-mail the invite was issued to', async () => {
    fetchMock.on('GET', INVITE_URL, json(PREVIEW));
    renderApp({ route: `/convite/${TOKEN}` });

    const email = await screen.findByLabelText('E-mail');
    expect(email).toHaveValue('ana@x.com');
    expect(email).toHaveAttribute('readonly');
  });

  it('lets the student type an e-mail when the invite only had a phone number', async () => {
    fetchMock.on('GET', INVITE_URL, json({ ...PREVIEW, email: null, phone: '11999999999' }));
    renderApp({ route: `/convite/${TOKEN}` });

    expect(await screen.findByLabelText('E-mail')).not.toHaveAttribute('readonly');
  });

  it('asks a phone-only invite for an e-mail, since login is always by e-mail', async () => {
    fetchMock.on('GET', INVITE_URL, json({ ...PREVIEW, email: null, phone: '11999999999' }));
    const { user } = renderApp({ route: `/convite/${TOKEN}` });

    await user.type(await screen.findByLabelText('Nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('Senha'), 'senha-forte-123');
    await user.click(screen.getByRole('checkbox', { name: /Termos de Uso/ }));
    await user.click(screen.getByRole('checkbox', { name: /Política de Privacidade/ }));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    // Caught here rather than as the API's 409 ("Informe um e-mail para concluir").
    expect(await screen.findByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(fetchMock.callsTo('POST', `${INVITE_URL}/accept`)).toHaveLength(0);
  });

  it('accepts a blank optional phone instead of calling it invalid', async () => {
    fetchMock.on('GET', INVITE_URL, json(PREVIEW));
    const { user } = renderApp({ route: `/convite/${TOKEN}` });

    await user.type(await screen.findByLabelText('Nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('Senha'), 'senha-forte-123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await screen.findByText('É necessário aceitar os Termos de Uso.');
    expect(screen.queryByText('Telefone inválido.')).not.toBeInTheDocument();
  });

  it('demands the two LGPD consents separately', async () => {
    fetchMock.on('GET', INVITE_URL, json(PREVIEW));
    const { user } = renderApp({ route: `/convite/${TOKEN}` });

    await user.type(await screen.findByLabelText('Nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('Senha'), 'senha-forte-123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('É necessário aceitar os Termos de Uso.')).toBeInTheDocument();
    expect(screen.getByText('É necessário aceitar a Política de Privacidade.')).toBeInTheDocument();
    expect(fetchMock.callsTo('POST', `${INVITE_URL}/accept`)).toHaveLength(0);
  });

  it('signs the new student in and lands them in the app', async () => {
    fetchMock.on('GET', INVITE_URL, json(PREVIEW));
    fetchMock.on(
      'POST',
      `${INVITE_URL}/accept`,
      json({
        accessToken: 'token',
        user: { id: 'u9', tenantId: 't1', name: 'Ana', email: 'ana@x.com', role: 'STUDENT' },
      }),
    );
    const { user, router } = renderApp({ route: `/convite/${TOKEN}` });

    await user.type(await screen.findByLabelText('Nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('Senha'), 'senha-forte-123');
    await user.click(screen.getByRole('checkbox', { name: /Termos de Uso/ }));
    await user.click(screen.getByRole('checkbox', { name: /Política de Privacidade/ }));
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
  });
});
