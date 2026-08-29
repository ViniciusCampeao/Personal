import { createBrowserRouter } from 'react-router-dom';
import { FullPageSpinner } from '@/components/app/full-page-spinner';
import { PublicLayout } from '@/layouts/public-layout';
import { AccessDeniedPage } from '@/pages/access-denied-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { LoginPage } from '@/features/auth/login-page';
import { AcceptInvitePage } from '@/features/invites/accept-invite-page';
import { PrivacyPage, TermsPage } from '@/features/legal/legal-page';
import { PATHS } from './paths';
import { RedirectIfAuthenticated, RequireRole } from './require-auth';
import { RootErrorBoundary } from './root-error-boundary';
import { RootRedirect } from './root-redirect';

/**
 * Data router, but for layouts, `errorElement` and code splitting only — data itself
 * belongs to TanStack Query (spec §1), so no `loader`/`action` fetches anything here.
 * Two loaders of truth for the same data is a bug factory.
 *
 * Each persona owns a prefixed subtree, which keeps its guard and layout in a single
 * route object and lets a student's bundle never include the trainer's screens.
 */
export const routes = [
  {
    errorElement: <RootErrorBoundary />,
    // Landing directly on `/app` or `/gestao` means the router has to resolve a lazy
    // subtree before it can render anything — without this the first paint is blank.
    hydrateFallbackElement: <FullPageSpinner />,
    children: [
      { path: PATHS.root, element: <RootRedirect /> },

      {
        element: <PublicLayout />,
        children: [
          {
            path: PATHS.login,
            element: (
              <RedirectIfAuthenticated>
                <LoginPage />
              </RedirectIfAuthenticated>
            ),
          },
          {
            path: PATHS.invitePattern,
            element: (
              <RedirectIfAuthenticated>
                <AcceptInvitePage />
              </RedirectIfAuthenticated>
            ),
          },
          { path: PATHS.terms, element: <TermsPage /> },
          { path: PATHS.privacy, element: <PrivacyPage /> },
          { path: PATHS.accessDenied, element: <AccessDeniedPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },

      {
        path: PATHS.studentHome,
        lazy: async () => {
          const { StudentLayout } = await import('@/layouts/student-layout');
          return {
            element: (
              <RequireRole allow="STUDENT">
                <StudentLayout />
              </RequireRole>
            ),
          };
        },
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('@/features/student/student-home-page')).StudentHomePage,
            }),
          },
          {
            path: 'historico',
            lazy: async () => ({
              Component: (await import('@/features/student/history-page')).HistoryPage,
            }),
          },
          {
            path: 'historico/:id',
            lazy: async () => ({
              Component: (await import('@/features/student/session-detail-page')).SessionDetailPage,
            }),
          },
          {
            path: 'progresso',
            lazy: async () => ({
              Component: (await import('@/features/progress/progress-page')).ProgressPage,
            }),
          },
          {
            path: 'avaliacoes',
            lazy: async () => ({
              Component: (await import('@/features/assessments/assessments-page')).AssessmentsPage,
            }),
          },
          {
            path: 'avaliacoes/:id',
            lazy: async () => ({
              Component: (await import('@/features/assessments/assessment-detail-page'))
                .AssessmentDetailPage,
            }),
          },
          {
            path: 'check-in',
            lazy: async () => ({
              Component: (await import('@/features/checkins/check-in-page')).CheckInPage,
            }),
          },
          {
            path: 'perfil',
            lazy: async () => ({
              Component: (await import('@/features/profile/profile-page')).ProfilePage,
            }),
          },
          {
            path: 'notificacoes',
            lazy: async () => ({
              Component: (await import('@/features/notifications/notifications-page'))
                .NotificationsPage,
            }),
          },
        ],
      },

      // Execution lives outside the tabbed shell (full-screen, one-handed use). The
      // branch is modelled now, without screens, so the phase that builds it doesn't
      // have to restructure this tree to escape the bottom nav.
      {
        path: PATHS.studentSessionPrefix,
        lazy: async () => {
          const { StudentFullscreenLayout } = await import('@/layouts/student-fullscreen-layout');
          return {
            element: (
              <RequireRole allow="STUDENT">
                <StudentFullscreenLayout />
              </RequireRole>
            ),
          };
        },
        children: [
          {
            // The id is the local `clientUuid`: the workout exists on the device before
            // the server has ever heard of it.
            path: ':id',
            lazy: async () => ({
              Component: (await import('@/features/workouts/execution-page')).WorkoutExecutionPage,
            }),
          },
        ],
      },

      {
        path: PATHS.trainerHome,
        lazy: async () => {
          const { TrainerLayout } = await import('@/layouts/trainer-layout');
          return {
            element: (
              <RequireRole allow="TRAINER">
                <TrainerLayout />
              </RequireRole>
            ),
          };
        },
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('@/features/trainer/trainer-dashboard-page'))
                .TrainerDashboardPage,
            }),
          },
          {
            path: 'alunos',
            lazy: async () => ({
              Component: (await import('@/features/students/students-page')).StudentsPage,
            }),
          },
          {
            path: 'alunos/:id',
            lazy: async () => ({
              Component: (await import('@/features/students/student-detail-page'))
                .StudentDetailPage,
            }),
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('@/features/students/tabs/overview-tab'))
                    .StudentOverviewTab,
                }),
              },
              {
                path: 'programa',
                lazy: async () => ({
                  Component: (await import('@/features/students/tabs/program-tab'))
                    .StudentProgramTab,
                }),
              },
              {
                path: 'historico',
                lazy: async () => ({
                  Component: (await import('@/features/students/tabs/history-tab'))
                    .StudentHistoryTab,
                }),
              },
              {
                path: 'progresso',
                lazy: async () => ({
                  Component: (await import('@/features/students/tabs/progress-tab'))
                    .StudentProgressTab,
                }),
              },
              {
                path: 'avaliacoes',
                lazy: async () => ({
                  Component: (await import('@/features/students/tabs/assessments-tab'))
                    .StudentAssessmentsTab,
                }),
              },
              {
                path: 'check-ins',
                lazy: async () => ({
                  Component: (await import('@/features/students/tabs/checkins-tab'))
                    .StudentCheckInsTab,
                }),
              },
              {
                path: 'anamnese',
                lazy: async () => ({
                  Component: (await import('@/features/students/tabs/anamnesis-tab'))
                    .StudentAnamnesisTab,
                }),
              },
            ],
          },
          {
            // Outside the sheet's tab shell: a form this long needs the whole page.
            path: 'alunos/:id/avaliacoes/nova',
            lazy: async () => ({
              Component: (await import('@/features/assessments/assessment-form-page'))
                .AssessmentFormPage,
            }),
          },
          {
            path: 'avaliacoes/:id',
            lazy: async () => ({
              Component: (await import('@/features/assessments/assessment-detail-page'))
                .AssessmentDetailPage,
            }),
          },
          {
            path: 'treinos/:id',
            lazy: async () => ({
              Component: (await import('@/features/student/session-detail-page')).SessionDetailPage,
            }),
          },
          {
            path: 'programas/novo',
            lazy: async () => ({
              Component: (await import('@/features/programs/new-program-page')).NewProgramPage,
            }),
          },
          {
            path: 'programas/:id',
            lazy: async () => ({
              Component: (await import('@/features/programs/program-editor-page'))
                .ProgramEditorPage,
            }),
          },
          {
            path: 'biblioteca',
            lazy: async () => ({
              Component: (await import('@/features/exercises/library-page')).ExerciseLibraryPage,
            }),
          },
          {
            path: 'templates',
            lazy: async () => ({
              Component: (await import('@/features/programs/templates-page')).TemplatesPage,
            }),
          },
          {
            path: 'notificacoes',
            lazy: async () => ({
              Component: (await import('@/features/notifications/notifications-page'))
                .NotificationsPage,
            }),
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
