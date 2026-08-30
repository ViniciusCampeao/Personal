import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AgendaEventType } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatWeekday } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { fetchAgendaEvents } from './agenda-api';

const TYPE_LABELS: Record<AgendaEventType, string> = {
  TRAINING: 'Treino',
  MEETING: 'Reunião',
  OTHER: 'Compromisso',
};

/** Read-only: the student sees what the trainer scheduled, no edit rights. */
export function StudentAgendaPage() {
  const from = useMemo(() => new Date(), []);
  const to = useMemo(() => {
    const end = new Date(from);
    end.setDate(end.getDate() + 30);
    return end;
  }, [from]);

  const events = useQuery({
    queryKey: ['agenda-events', 'me', from.toISOString(), to.toISOString()],
    queryFn: () => fetchAgendaEvents({ from: from.toISOString(), to: to.toISOString() }),
  });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Agenda</h1>

      {events.isPending ? (
        <Skeleton className="h-48" />
      ) : events.isError ? (
        <Alert variant="error">{problemMessage(events.error)}</Alert>
      ) : events.data!.length === 0 ? (
        <Card>
          <CardContent>
            <CardDescription>Nenhum compromisso agendado nos próximos 30 dias.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {events
            .data!.filter((event) => event.status === 'SCHEDULED')
            .map((event) => (
              <li key={event.id}>
                <Card>
                  <CardContent className="flex flex-col gap-1 py-3">
                    <p className="text-sm font-medium">
                      {TYPE_LABELS[event.type]} · {event.title}
                    </p>
                    <p className="text-xs text-text-muted">
                      {formatWeekday(event.startsAt)}, {formatDate(event.startsAt)} ·{' '}
                      {new Date(event.startsAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {event.notes ? <p className="text-sm text-text-muted">{event.notes}</p> : null}
                  </CardContent>
                </Card>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
