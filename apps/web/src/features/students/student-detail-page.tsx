import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { formatDate, formatRelativeDay } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { fetchStudent } from './students-api';

const TABS = [
  { to: '.', label: 'Resumo', end: true },
  { to: 'programa', label: 'Programa', end: false },
  { to: 'historico', label: 'Histórico', end: false },
  { to: 'progresso', label: 'Progresso', end: false },
  { to: 'avaliacoes', label: 'Avaliações', end: false },
  { to: 'check-ins', label: 'Check-ins', end: false },
  { to: 'anamnese', label: 'Anamnese', end: false },
] as const;

/**
 * The student sheet (spec §8). The tabs are routes rather than local state so a trainer
 * can link a colleague straight to, say, the anamnesis.
 */
export function StudentDetailPage() {
  const { id = '' } = useParams();
  const student = useQuery({
    queryKey: ['students', id, 'detail'],
    queryFn: () => fetchStudent(id),
  });

  if (student.isPending) return <Skeleton className="h-64" />;
  if (student.isError) return <Alert variant="error">{problemMessage(student.error)}</Alert>;

  const data = student.data;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <NavLink to={PATHS.trainerStudents} className="text-sm text-accent underline">
          ← Alunos
        </NavLink>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="text-sm text-text-muted">
          {data.email}
          {data.phone ? ` · ${data.phone}` : ''} · aluno desde {formatDate(data.startedAt)}
        </p>
        <p className="text-sm text-text-muted">
          {data.activeProgramName ? (
            <>Programa: {data.activeProgramName}</>
          ) : (
            <span className="text-warning">Sem programa ativo</span>
          )}
          {' · '}
          {data.lastSessionAt
            ? `último treino ${formatRelativeDay(data.lastSessionAt)}`
            : 'nunca treinou'}
          {' · '}
          {data.totalSessions} {data.totalSessions === 1 ? 'treino' : 'treinos'}
        </p>
      </header>

      <nav aria-label="Seções do aluno" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b border-border">
          {TABS.map((tab) => (
            <li key={tab.label}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-touch items-center whitespace-nowrap border-b-2 px-3 text-sm',
                    isActive
                      ? 'border-accent text-text'
                      : 'border-transparent text-text-muted hover:text-text',
                  )
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet context={data} />
    </div>
  );
}
