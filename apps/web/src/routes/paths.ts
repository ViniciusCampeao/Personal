import { type AuthenticatedUserDto } from '@pt/shared';

/** URLs are pt-BR: the API already generates `/convite/:token` for invite links. */
export const PATHS = {
  root: '/',
  login: '/entrar',
  invite: (token: string) => `/convite/${token}`,
  invitePattern: '/convite/:token',
  terms: '/termos',
  privacy: '/privacidade',
  accessDenied: '/sem-acesso',

  studentHome: '/app',
  studentHistory: '/app/historico',
  studentSessionDetail: (id: string) => `/app/historico/${id}`,
  studentProgress: '/app/progresso',
  studentAssessments: '/app/avaliacoes',
  studentAssessmentDetail: (id: string) => `/app/avaliacoes/${id}`,
  studentCheckIn: '/app/check-in',
  studentProfile: '/app/perfil',
  studentNotifications: '/app/notificacoes',
  studentDiet: '/app/dieta',
  studentAgenda: '/app/agenda',
  studentSessionPrefix: '/app/treino',
  studentSession: (id: string) => `/app/treino/${id}`,

  trainerHome: '/gestao',
  trainerStudents: '/gestao/alunos',
  trainerStudent: (id: string) => `/gestao/alunos/${id}`,
  trainerLibrary: '/gestao/biblioteca',
  trainerTemplates: '/gestao/templates',
  trainerPrograms: '/gestao/programas',
  trainerNotifications: '/gestao/notificacoes',
  trainerProgram: (id: string) => `/gestao/programas/${id}`,
  trainerAgenda: '/gestao/agenda',
  trainerProfile: '/gestao/perfil',

  admin: '/admin',
} as const;

/** Each persona owns a prefixed subtree, so the same screen lives at two URLs. */
export function notificationsPathFor(role: AuthenticatedUserDto['role']): string {
  return role === 'TRAINER' ? PATHS.trainerNotifications : PATHS.studentNotifications;
}

/** Where a signed-in user belongs. */
export function homePathFor(role: AuthenticatedUserDto['role']): string {
  switch (role) {
    case 'STUDENT':
      return PATHS.studentHome;
    case 'TRAINER':
      return PATHS.trainerHome;
    case 'ADMIN':
      return PATHS.admin;
  }
}
