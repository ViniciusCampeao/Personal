import { screen, waitFor } from '@testing-library/react';
import type { MyProfileDto } from '@pt/shared';
import { json, mockFetch, noContent, problem, type FetchMock } from '@/test-utils/fetch-mock';
import { resetLocalDb } from '@/test-utils/indexeddb';
import { renderApp } from '@/test-utils/render';
import { resetAuthStore } from '@/features/auth/auth-store';
import { resetSyncEngine } from '@/features/sync/sync-engine';

const STUDENT = {
  accessToken: 'token',
  user: { id: 'u1', tenantId: 't1', name: 'Ana Souza', email: 'ana@x.com', role: 'STUDENT' },
};

const PROFILE: MyProfileDto = {
  id: 'u1',
  name: 'Ana Souza',
  email: 'ana@x.com',
  phone: '11999999999',
  role: 'STUDENT',
  avatarUrl: null,
  createdAt: '2026-01-10T10:00:00.000Z',
  student: {
    trainerId: 't-1',
    trainerName: 'Treinador Silva',
    birthDate: '1995-04-02T00:00:00.000Z',
    sex: 'FEMALE',
    heightCm: 168,
    goal: 'Hipertrofia',
    experienceLevel: 'INTERMEDIATE',
    weeklyAvailability: 4,
    startedAt: '2026-02-01T00:00:00.000Z',
  },
  consents: [
    { type: 'TERMS', version: 'v1', acceptedAt: '2026-02-01T12:00:00.000Z', revokedAt: null },
    { type: 'PRIVACY', version: 'v1', acceptedAt: '2026-02-01T12:00:00.000Z', revokedAt: null },
  ],
};

describe('ProfilePage', () => {
  let fetchMock: FetchMock;

  beforeEach(async () => {
    fetchMock = mockFetch();
    resetAuthStore();
    resetSyncEngine();
    await resetLocalDb();
    fetchMock.on('POST', '/api/v1/auth/refresh', json(STUDENT));
    fetchMock.on('POST', '/api/v1/sessions/sync', () => problem(503));
    fetchMock.on('GET', '/api/v1/notifications?unreadOnly=true&limit=20', json({ items: [] }));
    fetchMock.on('GET', '/api/v1/me/profile', json(PROFILE));
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
    resetSyncEngine();
  });

  it('shows what was consented to, and when', async () => {
    renderApp({ route: '/app/perfil' });

    expect(await screen.findByText('Termos de Uso')).toBeInTheDocument();
    expect(screen.getByText('Política de Privacidade')).toBeInTheDocument();
    expect(screen.getAllByText(/aceito em 01\/02\/2026 \(v1\)/)).toHaveLength(2);
  });

  it('keeps the e-mail read-only: it is the login identity', async () => {
    renderApp({ route: '/app/perfil' });

    expect(await screen.findByLabelText('E-mail')).toHaveAttribute('readonly');
  });

  it('saves the profile and the measurement fields in one request', async () => {
    fetchMock.on('PATCH', '/api/v1/me/profile', json({ ...PROFILE, name: 'Ana S.' }));
    const { user } = renderApp({ route: '/app/perfil' });

    const name = await screen.findByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Ana S.');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(fetchMock.callsTo('PATCH', '/api/v1/me/profile')).toHaveLength(1));
    const body = JSON.parse(fetchMock.callsTo('PATCH', '/api/v1/me/profile')[0]!.body ?? '{}');
    expect(body).toMatchObject({ name: 'Ana S.', heightCm: 168, experienceLevel: 'INTERMEDIATE' });
  });

  it('hands the export to the browser as a file', async () => {
    fetchMock.on('GET', '/api/v1/me/export', json({ exportedAt: '2026-08-29T10:00:00.000Z' }));
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = jest.fn(() => 'blob:fake');
    URL.revokeObjectURL = jest.fn();
    const { user } = renderApp({ route: '/app/perfil' });

    await user.click(await screen.findByRole('button', { name: 'Exportar meus dados' }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });

  it('needs the password and the typed word before it will erase anything', async () => {
    fetchMock.on('DELETE', '/api/v1/me', noContent());
    fetchMock.on('POST', '/api/v1/auth/logout', noContent());
    const { user } = renderApp({ route: '/app/perfil' });

    await user.click(await screen.findByRole('button', { name: 'Quero excluir minha conta' }));
    const confirm = await screen.findByRole('button', { name: 'Excluir definitivamente' });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText('Sua senha'), 'senha-123');
    await user.type(screen.getByLabelText('Digite EXCLUIR para confirmar'), 'EXCLUIR');
    expect(confirm).toBeEnabled();

    await user.click(confirm);

    await waitFor(() => expect(fetchMock.callsTo('DELETE', '/api/v1/me')).toHaveLength(1));
  });
});
