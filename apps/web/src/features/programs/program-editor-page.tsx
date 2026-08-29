import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProgramDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { BackLink } from '@/components/app/back-link';
import { cn } from '@/lib/cn';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { DayEditor } from './components/day-editor';
import {
  activateProgram,
  createDay,
  deleteDay,
  deleteProgram,
  duplicateProgram,
  fetchProgram,
  updateDay,
  updateProgram,
} from './programs-api';

const STATUS_LABELS: Record<ProgramDto['status'], string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  FINISHED: 'Encerrado',
  ARCHIVED: 'Arquivado',
};

export function ProgramEditorPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const program = useQuery({ queryKey: ['programs', id], queryFn: () => fetchProgram(id) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['programs'] });

  const rename = useMutation({
    mutationFn: (name: string) => updateProgram(id, { name }),
    meta: { silent: true },
    onSuccess: invalidate,
  });

  const activate = useMutation({
    mutationFn: () => activateProgram(id),
    meta: { silent: true },
    onSuccess: async () => {
      await invalidate();
      toast('Programa ativado. O aluno já vê o treino de hoje.', 'success');
    },
  });

  const duplicate = useMutation({
    mutationFn: (asTemplate: boolean) => duplicateProgram(id, { asTemplate }),
    meta: { silent: true },
    onSuccess: async (created) => {
      await invalidate();
      toast(created.isTemplate ? 'Template criado.' : 'Cópia criada.', 'success');
      navigate(PATHS.trainerProgram(created.id));
    },
  });

  const addDay = useMutation({
    mutationFn: (label: string) => createDay(id, { label }),
    meta: { silent: true },
    onSuccess: async (day) => {
      await invalidate();
      setSelectedDayId(day.id);
    },
  });

  const renameDay = useMutation({
    mutationFn: ({ dayId, label }: { dayId: string; label: string }) => updateDay(dayId, { label }),
    meta: { silent: true },
    onSuccess: invalidate,
  });

  const removeDay = useMutation({
    mutationFn: (dayId: string) => deleteDay(dayId),
    meta: { silent: true },
    onSuccess: async () => {
      setSelectedDayId(null);
      await invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteProgram(id),
    meta: { silent: true },
    onSuccess: async () => {
      await invalidate();
      navigate(PATHS.trainerStudents);
    },
  });

  if (program.isPending) return <Skeleton className="h-96" />;
  if (program.isError) return <Alert variant="error">{problemMessage(program.error)}</Alert>;

  const data = program.data;
  const days = [...data.days].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentDay = days.find((day) => day.id === selectedDayId) ?? days[0] ?? null;
  const nextLabel = String.fromCharCode(65 + days.length);

  return (
    <div className="flex flex-col gap-5">
      <BackLink label="Voltar" />

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            aria-label="Nome do programa"
            defaultValue={data.name}
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name !== data.name) rename.mutate(name);
            }}
            className="max-w-md text-lg font-semibold"
          />
          <span className="rounded-full bg-surface-raised px-3 py-1 text-xs text-text-muted">
            {STATUS_LABELS[data.status]}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.status !== 'ACTIVE' && !data.isTemplate ? (
            <Button loading={activate.isPending} onClick={() => activate.mutate()}>
              Ativar programa
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => duplicate.mutate(false)}>
            Duplicar
          </Button>
          {!data.isTemplate ? (
            <Button variant="secondary" onClick={() => duplicate.mutate(true)}>
              Salvar como template
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => remove.mutate()}>
            Excluir programa
          </Button>
        </div>

        {activate.isError ? <Alert variant="error">{problemMessage(activate.error)}</Alert> : null}
        {remove.isError ? <Alert variant="error">{problemMessage(remove.error)}</Alert> : null}
      </header>

      <nav aria-label="Dias do programa" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex items-center gap-2">
          {days.map((day) => (
            <li key={day.id}>
              <button
                type="button"
                onClick={() => setSelectedDayId(day.id)}
                aria-current={currentDay?.id === day.id ? 'true' : undefined}
                className={cn(
                  'min-h-touch whitespace-nowrap rounded-lg border px-4 text-sm',
                  currentDay?.id === day.id
                    ? 'border-accent bg-accent/10 text-text'
                    : 'border-border bg-surface-raised text-text-muted',
                )}
              >
                {day.label}
                <span className="ml-2 text-xs text-text-subtle">{day.exercises.length} ex.</span>
              </button>
            </li>
          ))}
          <li>
            <Button
              variant="secondary"
              loading={addDay.isPending}
              onClick={() => addDay.mutate(nextLabel)}
            >
              + Dia
            </Button>
          </li>
        </ul>
      </nav>

      {!currentDay ? (
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-text-muted">
          Comece criando o primeiro dia de treino.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Rótulo do dia"
              defaultValue={currentDay.label}
              key={currentDay.id}
              onBlur={(event) => {
                const label = event.target.value.trim();
                if (label && label !== currentDay.label) {
                  renameDay.mutate({ dayId: currentDay.id, label });
                }
              }}
              className="max-w-24"
            />
            <Button variant="ghost" size="sm" onClick={() => removeDay.mutate(currentDay.id)}>
              Excluir dia
            </Button>
          </div>

          <DayEditor programId={id} day={currentDay} />
        </div>
      )}
    </div>
  );
}
