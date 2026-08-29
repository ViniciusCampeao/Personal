import { screen } from '@testing-library/react';
import type { StudentDetailDto } from '@pt/shared';
import { json, mockFetch, type FetchMock } from '@/test-utils/fetch-mock';
import { resetLocalDb } from '@/test-utils/indexeddb';
import { renderApp } from '@/test-utils/render';
import { resetAuthStore } from '@/features/auth/auth-store';
import { resetSyncEngine } from '@/features/sync/sync-engine';

const TRAINER = {
  accessToken: 'token',
  user: { id: 't1', tenantId: 'tn1', name: 'Treinador', email: 't@x.com', role: 'TRAINER' },
};

const STUDENT: StudentDetailDto = {
  id: 's1',
  name: 'Ana Souza',
  email: 'ana@x.com',
  phone: '11999999999',
  status: 'ACTIVE',
  goal: 'Hipertrofia',
  experienceLevel: 'INTERMEDIATE',
  startedAt: '2026-02-01T12:00:00.000Z',
  lastSessionAt: '2026-08-28T12:00:00.000Z',
  adherenceRatio: 0.9,
  activeProgramId: 'p1',
  activeProgramName: 'Full body 3x',
  hasPendingCheckIn: false,
  birthDate: '1995-04-02T12:00:00.000Z',
  sex: 'FEMALE',
  heightCm: 168,
  weeklyAvailability: 4,
  privateNotes: 'Ombro sensível',
  lastAssessmentAt: null,
  totalSessions: 42,
};

describe('StudentDetailPage', () => {
  let fetchMock: FetchMock;

  beforeEach(async () => {
    fetchMock = mockFetch();
    resetAuthStore();
    resetSyncEngine();
    await resetLocalDb();
    fetchMock.on('POST', '/api/v1/auth/refresh', json(TRAINER));
    fetchMock.on('GET', '/api/v1/notifications?unreadOnly=true&limit=20', json({ items: [] }));
    fetchMock.on('GET', '/api/v1/students/s1', json(STUDENT));
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
    resetSyncEngine();
  });

  it('opens on the summary, with the notes only the trainer can see', async () => {
    renderApp({ route: '/gestao/alunos/s1' });

    expect(await screen.findByRole('heading', { name: 'Ana Souza' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Notas privadas')).toHaveValue('Ombro sensível');
    expect(
      screen.getByText('Visível só para você — o aluno nunca vê este campo.'),
    ).toBeInTheDocument();
  });

  it('warns before opening health data that the access is logged', async () => {
    fetchMock.on(
      'GET',
      '/api/v1/students/s1/anamnesis',
      json({ versions: [], medicalClearance: null }),
    );
    const { user } = renderApp({ route: '/gestao/alunos/s1' });

    await user.click(await screen.findByRole('link', { name: 'Anamnese' }));

    expect(
      await screen.findByText(/Todo acesso seu fica registrado em log de auditoria/),
    ).toBeInTheDocument();
  });

  it('keeps the tab in the URL so a section can be linked directly', async () => {
    fetchMock.on('GET', '/api/v1/students/s1/check-ins?limit=50', json({ items: [] }));
    renderApp({ route: '/gestao/alunos/s1/check-ins' });

    expect(await screen.findByText('Nenhum check-in respondido ainda.')).toBeInTheDocument();
  });
});
