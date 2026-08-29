import { screen, waitFor } from '@testing-library/react';
import type { StudentSummaryDto } from '@pt/shared';
import { json, mockFetch, type FetchMock } from '@/test-utils/fetch-mock';
import { resetLocalDb } from '@/test-utils/indexeddb';
import { renderApp } from '@/test-utils/render';
import { resetAuthStore } from '@/features/auth/auth-store';
import { resetSyncEngine } from '@/features/sync/sync-engine';

const TRAINER = {
  accessToken: 'token',
  user: { id: 't1', tenantId: 'tn1', name: 'Treinador', email: 't@x.com', role: 'TRAINER' },
};

function student(overrides: Partial<StudentSummaryDto> = {}): StudentSummaryDto {
  return {
    id: 's1',
    name: 'Ana Souza',
    email: 'ana@x.com',
    phone: null,
    status: 'ACTIVE',
    goal: 'Hipertrofia',
    experienceLevel: 'INTERMEDIATE',
    startedAt: '2026-02-01T12:00:00.000Z',
    lastSessionAt: '2026-08-28T12:00:00.000Z',
    adherenceRatio: 0.9,
    activeProgramId: 'p1',
    activeProgramName: 'Full body 3x',
    hasPendingCheckIn: false,
    ...overrides,
  };
}

describe('StudentsPage', () => {
  let fetchMock: FetchMock;

  beforeEach(async () => {
    fetchMock = mockFetch();
    resetAuthStore();
    resetSyncEngine();
    await resetLocalDb();
    fetchMock.on('POST', '/api/v1/auth/refresh', json(TRAINER));
    fetchMock.on('GET', '/api/v1/notifications?unreadOnly=true&limit=20', json({ items: [] }));
  });

  afterEach(() => {
    fetchMock.restore();
    resetAuthStore();
    resetSyncEngine();
  });

  it('shows the two things a trainer opens this screen for: activity and adherence', async () => {
    fetchMock.on(
      'GET',
      '/api/v1/students?limit=50',
      json({ items: [student()], nextCursor: null }),
    );
    renderApp({ route: '/gestao/alunos' });

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Full body 3x')).toBeInTheDocument();
    // The percentage is spelled out, so colour is never the only carrier.
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('flags a student with no active program', async () => {
    fetchMock.on(
      'GET',
      '/api/v1/students?limit=50',
      json({
        items: [student({ activeProgramId: null, activeProgramName: null })],
        nextCursor: null,
      }),
    );
    renderApp({ route: '/gestao/alunos' });

    expect(await screen.findByText('Sem programa')).toBeInTheDocument();
  });

  it('asks the server for the filter instead of narrowing the page locally', async () => {
    fetchMock.on(
      'GET',
      '/api/v1/students?limit=50',
      json({ items: [student()], nextCursor: null }),
    );
    fetchMock.on(
      'GET',
      '/api/v1/students?inactiveDays=10&limit=50',
      json({ items: [], nextCursor: null }),
    );
    const { user } = renderApp({ route: '/gestao/alunos' });

    await user.click(await screen.findByRole('button', { name: 'Sem treinar há 10 dias' }));

    await waitFor(() =>
      expect(fetchMock.callsTo('GET', '/api/v1/students?inactiveDays=10&limit=50')).toHaveLength(1),
    );
    expect(await screen.findByText('Nenhum aluno com esses critérios.')).toBeInTheDocument();
  });

  it('hands back a shareable invite link and QR code', async () => {
    fetchMock.on('GET', '/api/v1/students?limit=50', json({ items: [], nextCursor: null }));
    fetchMock.on(
      'POST',
      '/api/v1/invites',
      json({
        id: 'i1',
        token: 'abc',
        url: 'http://localhost:5173/convite/abc',
        qrCodeDataUrl: 'data:image/png;base64,AAA',
        expiresAt: '2026-09-05T12:00:00.000Z',
      }),
    );
    const { user } = renderApp({ route: '/gestao/alunos' });

    await user.click(await screen.findByRole('button', { name: 'Convidar aluno' }));
    await user.type(screen.getByLabelText('E-mail'), 'novo@x.com');
    await user.click(screen.getByRole('button', { name: 'Gerar convite' }));

    expect(await screen.findByText('Convite criado')).toBeInTheDocument();
    expect(screen.getByAltText('QR code do convite')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:5173/convite/abc')).toBeInTheDocument();
  });
});
