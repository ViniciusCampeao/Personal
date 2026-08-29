import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ListProgramsResponseDto, ProgramDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { TECHNIQUE_LABELS, labelOf } from '@/lib/labels';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { summarizePrescription } from '@/features/workouts/prescription';
import { useStudent } from './use-student';

export function StudentProgramTab() {
  const student = useStudent();

  const programs = useQuery({
    queryKey: ['programs', { studentId: student.id }],
    queryFn: () => apiFetch<ListProgramsResponseDto>(`/programs?studentId=${student.id}`),
  });

  const activeId = student.activeProgramId;
  const active = useQuery({
    queryKey: ['programs', activeId],
    enabled: Boolean(activeId),
    queryFn: () => apiFetch<ProgramDto>(`/programs/${activeId}`),
  });

  if (programs.isPending) return <Skeleton className="h-48" />;
  if (programs.isError) return <Alert variant="error">{problemMessage(programs.error)}</Alert>;

  const others = programs.data.items.filter((program) => program.id !== activeId);

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={`${PATHS.trainerPrograms}/novo?aluno=${student.id}`}
        className={cn(buttonVariants(), 'self-start')}
      >
        Novo programa
      </Link>

      {!activeId ? (
        <Card>
          <CardContent>
            <CardDescription>
              Este aluno não tem programa ativo. Crie um e ative para que o treino do dia apareça no
              app dele.
            </CardDescription>
          </CardContent>
        </Card>
      ) : active.isPending ? (
        <Skeleton className="h-64" />
      ) : active.isError ? (
        <Alert variant="error">{problemMessage(active.error)}</Alert>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <h2 className="text-base font-semibold">{active.data.name}</h2>
              <p className="text-sm text-text-muted">
                {active.data.goal ?? 'Sem objetivo definido'}
                {active.data.startDate ? ` · desde ${formatDate(active.data.startDate)}` : ''}
              </p>
            </div>
            <Link
              to={PATHS.trainerProgram(active.data.id)}
              className={cn(buttonVariants({ variant: 'secondary' }))}
            >
              Editar programa
            </Link>
          </div>

          <ul className="flex flex-col gap-3">
            {active.data.days.map((day) => (
              <li key={day.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2">
                    <CardTitle>
                      {day.label}
                      {day.name ? ` — ${day.name}` : ''}
                    </CardTitle>
                    {day.exercises.length === 0 ? (
                      <CardDescription>Dia sem exercícios.</CardDescription>
                    ) : (
                      <ul className="flex flex-col gap-1 text-sm">
                        {day.exercises.map((exercise) => (
                          <li key={exercise.id} className="flex justify-between gap-3">
                            <span className="truncate">
                              {exercise.exercise.name}
                              {exercise.technique !== 'NORMAL'
                                ? ` · ${labelOf(TECHNIQUE_LABELS, exercise.technique)}`
                                : ''}
                            </span>
                            <span className="shrink-0 text-text-muted">
                              {summarizePrescription(exercise.sets)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Outros programas</h2>
          <ul className="flex flex-col gap-2">
            {others.map((program) => (
              <li key={program.id}>
                <Link
                  to={PATHS.trainerProgram(program.id)}
                  className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-4 py-3 hover:border-border-strong"
                >
                  <span className="text-sm font-medium">{program.name}</span>
                  <span className="text-xs text-text-subtle">{program.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
