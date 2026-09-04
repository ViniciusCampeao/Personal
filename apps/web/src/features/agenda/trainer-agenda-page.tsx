import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgendaEventDto, AgendaEventType, UpsertAgendaEventInput } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, formatWeekday } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { listStudents } from '@/features/students/students-api';
import { PageHeader } from '@/components/app/page-header';
import {
  createAgendaEvent,
  deleteAgendaEvent,
  fetchAgendaEvents,
  updateAgendaEventStatus,
} from './agenda-api';

const TYPE_LABELS: Record<AgendaEventType, string> = {
  TRAINING: 'Treino',
  MEETING: 'Reunião',
  OTHER: 'Outro',
};

function mondayOf(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + diff);
  return monday;
}

export function TrainerAgendaPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  const from = useMemo(() => {
    const monday = mondayOf(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);
    return monday;
  }, [weekOffset]);
  const to = useMemo(() => {
    const end = new Date(from);
    end.setDate(end.getDate() + 7);
    end.setMilliseconds(-1);
    return end;
  }, [from]);

  const events = useQuery({
    queryKey: ['agenda-events', from.toISOString(), to.toISOString()],
    queryFn: () => fetchAgendaEvents({ from: from.toISOString(), to: to.toISOString() }),
  });

  const students = useQuery({
    queryKey: ['students', 'for-agenda'],
    queryFn: () => listStudents({}, { limit: 100 }),
  });

  const [studentId, setStudentId] = useState('');
  const [type, setType] = useState<AgendaEventType>('TRAINING');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [notes, setNotes] = useState('');

  const createMutation = useMutation({
    mutationFn: (input: UpsertAgendaEventInput) => createAgendaEvent(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agenda-events'] });
      toast('Compromisso criado.', 'success');
      setFormOpen(false);
      setTitle('');
      setNotes('');
      setStudentId('');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'DONE' | 'CANCELED' }) =>
      updateAgendaEventStatus(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agenda-events'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAgendaEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agenda-events'] }),
  });

  function handleCreate() {
    if (!title.trim() || !startsAt || !endsAt) return;
    createMutation.mutate({
      studentId: studentId || undefined,
      type,
      title: title.trim(),
      notes: notes.trim() || undefined,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    });
  }

  const grouped = useMemo(() => {
    const map = new Map<string, AgendaEventDto[]>();
    for (const event of events.data ?? []) {
      const day = formatDate(event.startsAt);
      map.set(day, [...(map.get(day) ?? []), event]);
    }
    return map;
  }, [events.data]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Agenda"
        description="Treinos e reuniões marcados com seus alunos."
        actions={
          <Button onClick={() => setFormOpen((open) => !open)}>
            {formOpen ? 'Cancelar' : 'Novo compromisso'}
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={() => setWeekOffset((o) => o - 1)}>
          ← Semana anterior
        </Button>
        <span className="text-sm text-text-muted">
          {formatDate(from)} – {formatDate(to)}
        </span>
        <Button size="sm" variant="secondary" onClick={() => setWeekOffset((o) => o + 1)}>
          Próxima semana →
        </Button>
      </div>

      {formOpen ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <CardTitle>Novo compromisso</CardTitle>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium">Tipo</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as AgendaEventType)}
                  className="min-h-touch rounded-field border border-border bg-surface-sunken px-3 text-base text-text"
                >
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium">Aluno (opcional)</span>
                <select
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  className="min-h-touch rounded-field border border-border bg-surface-sunken px-3 text-base text-text"
                >
                  <option value="">— nenhum —</option>
                  {students.data?.items.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Título</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="min-h-touch rounded-field border border-border bg-surface-sunken px-3 text-base text-text"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium">Início</span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  className="min-h-touch rounded-field border border-border bg-surface-sunken px-3 text-base text-text"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium">Fim</span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  className="min-h-touch rounded-field border border-border bg-surface-sunken px-3 text-base text-text"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Notas (opcional)</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="rounded-field border border-border bg-surface-sunken p-3 text-base text-text"
              />
            </label>

            {createMutation.isError ? (
              <Alert variant="error">{problemMessage(createMutation.error)}</Alert>
            ) : null}

            <Button
              className="self-start"
              loading={createMutation.isPending}
              disabled={!title.trim() || !startsAt || !endsAt}
              onClick={handleCreate}
            >
              Criar compromisso
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {events.isPending ? (
        <Skeleton className="h-48" />
      ) : events.isError ? (
        <Alert variant="error">{problemMessage(events.error)}</Alert>
      ) : grouped.size === 0 ? (
        <Card>
          <CardContent>
            <CardDescription>Nenhum compromisso nesta semana.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([day, dayEvents]) => (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold capitalize text-text-muted">
              {formatWeekday(dayEvents[0]!.startsAt)}, {day}
            </h2>
            <ul className="flex flex-col gap-2">
              {dayEvents.map((event) => (
                <li key={event.id}>
                  <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium">
                          {TYPE_LABELS[event.type]} · {event.title}
                          {event.studentName ? ` · ${event.studentName}` : ''}
                        </p>
                        <p className="text-xs text-text-muted">
                          {new Date(event.startsAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          –{' '}
                          {new Date(event.endsAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          ·{' '}
                          {event.status === 'SCHEDULED'
                            ? 'Agendado'
                            : event.status === 'DONE'
                              ? 'Concluído'
                              : 'Cancelado'}
                        </p>
                      </div>
                      {event.status === 'SCHEDULED' ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => statusMutation.mutate({ id: event.id, status: 'DONE' })}
                          >
                            Concluir
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger"
                            onClick={() => deleteMutation.mutate(event.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
