import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BackLink } from '@/components/app/back-link';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { fetchStudent } from '@/features/students/students-api';
import { PageHeader } from '@/components/app/page-header';
import { createProgram, duplicateProgram, listPrograms } from './programs-api';

/**
 * Two ways to start (spec §8): from scratch, or from a template. Starting from a
 * template is a server-side duplicate, so the whole day/exercise/set tree comes along.
 */
export function NewProgramPage() {
  const [params] = useSearchParams();
  const studentId = params.get('aluno') ?? '';
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [weeks, setWeeks] = useState('8');

  const student = useQuery({
    queryKey: ['students', studentId, 'detail'],
    enabled: Boolean(studentId),
    queryFn: () => fetchStudent(studentId),
  });

  const templates = useQuery({
    queryKey: ['programs', { isTemplate: true }],
    queryFn: () => listPrograms({ isTemplate: true, limit: 50 }),
  });

  const create = useMutation({
    mutationFn: () =>
      createProgram({
        studentId,
        isTemplate: false,
        name: name.trim(),
        ...(goal.trim() ? { goal: goal.trim() } : {}),
        ...(Number(weeks) > 0 ? { weeks: Number(weeks) } : {}),
      }),
    meta: { silent: true },
    onSuccess: (program) => navigate(PATHS.trainerProgram(program.id), { replace: true }),
  });

  const fromTemplate = useMutation({
    mutationFn: (templateId: string) => duplicateProgram(templateId, { studentId }),
    meta: { silent: true },
    onSuccess: (program) => navigate(PATHS.trainerProgram(program.id), { replace: true }),
  });

  if (!studentId) {
    return <Alert variant="error">Escolha um aluno antes de criar um programa.</Alert>;
  }
  if (student.isPending) return <Skeleton className="h-64" />;
  if (student.isError) return <Alert variant="error">{problemMessage(student.error)}</Alert>;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink label="Voltar" />

      <PageHeader title="Novo programa" description={`Para ${student.data.name}`} />

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Do zero</h2>

        <Field label="Nome">
          {(field) => (
            <Input
              {...field}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full body 3x / semana"
            />
          )}
        </Field>

        <Field label="Objetivo">
          {(field) => (
            <Input {...field} value={goal} onChange={(event) => setGoal(event.target.value)} />
          )}
        </Field>

        <Field label="Duração (semanas)">
          {(field) => (
            <Input
              {...field}
              value={weeks}
              onChange={(event) => setWeeks(event.target.value)}
              inputMode="numeric"
            />
          )}
        </Field>

        {create.isError ? <Alert variant="error">{problemMessage(create.error)}</Alert> : null}

        <Button
          loading={create.isPending}
          disabled={name.trim().length < 2}
          onClick={() => create.mutate()}
          className="self-start"
        >
          Criar programa
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">A partir de um template</h2>
        {templates.isPending ? (
          <Skeleton className="h-24" />
        ) : templates.data?.items.length === 0 ? (
          <p className="text-sm text-text-muted">
            Você ainda não salvou nenhum template. Qualquer programa pode virar um.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {templates.data!.items.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => fromTemplate.mutate(template.id)}
                  className="flex min-h-touch w-full items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-4 py-3 text-left hover:border-border-strong"
                >
                  <span className="text-sm font-medium">{template.name}</span>
                  <span className="text-xs text-text-subtle">
                    {template.goal ?? 'sem objetivo'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {fromTemplate.isError ? (
          <Alert variant="error">{problemMessage(fromTemplate.error)}</Alert>
        ) : null}
      </section>
    </div>
  );
}
