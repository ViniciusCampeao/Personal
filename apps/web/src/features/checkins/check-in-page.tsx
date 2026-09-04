import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubmitCheckInInput } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { ScaleField } from '@/components/ui/scale-field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, formatWeight } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { useAuth } from '@/features/auth/auth-context';
import { PageHeader } from '@/components/app/page-header';
import { fetchCheckIns, fetchCurrentCheckIn, submitCheckIn } from './checkins-api';

const CHECK_IN_KEY = ['me', 'check-in', 'current'];

/**
 * Weekly check-in (spec §9). The week itself is decided by the server, so this screen
 * never sends a date — it only ever answers "how was this week".
 */
export function CheckInPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const current = useQuery({ queryKey: CHECK_IN_KEY, queryFn: fetchCurrentCheckIn });
  const history = useQuery({
    queryKey: ['students', user?.id, 'check-ins'],
    enabled: Boolean(user?.id),
    queryFn: () => fetchCheckIns(user!.id, { limit: 8 }),
  });

  const [sleepQuality, setSleep] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [soreness, setSoreness] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [weightKg, setWeight] = useState('');
  const [notes, setNotes] = useState('');

  // An answered week is editable, not read-only: the API upserts, and a student who got
  // a value wrong should be able to fix it before the trainer reads it.
  useEffect(() => {
    const answered = current.data;
    if (!answered) return;
    setSleep(answered.sleepQuality);
    setEnergy(answered.energy);
    setSoreness(answered.soreness);
    setStress(answered.stress);
    setWeight(answered.weightKg != null ? String(answered.weightKg) : '');
    setNotes(answered.notes ?? '');
  }, [current.data]);

  const mutation = useMutation({
    mutationFn: (input: SubmitCheckInInput) => submitCheckIn(input),
    meta: { silent: true },
    onSuccess: async (saved) => {
      queryClient.setQueryData(CHECK_IN_KEY, saved);
      await queryClient.invalidateQueries({ queryKey: ['students', user?.id, 'check-ins'] });
      toast('Check-in enviado. Seu treinador já consegue ver.', 'success');
    },
  });

  function handleSubmit() {
    const weight = Number(weightKg.replace(',', '.'));
    mutation.mutate({
      ...(sleepQuality != null ? { sleepQuality } : {}),
      ...(energy != null ? { energy } : {}),
      ...(soreness != null ? { soreness } : {}),
      ...(stress != null ? { stress } : {}),
      ...(weightKg.trim() !== '' && Number.isFinite(weight) ? { weightKg: weight } : {}),
      ...(notes.trim() !== '' ? { notes: notes.trim() } : {}),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Check-in da semana"
        description={
          current.data
            ? `Você já respondeu esta semana (${formatDate(current.data.weekStart)}). Pode ajustar.`
            : 'Leva menos de um minuto e ajuda seu treinador a ajustar a carga.'
        }
      />

      {current.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="flex flex-col gap-5">
          <ScaleField
            label="Qualidade do sono"
            value={sleepQuality}
            onChange={setSleep}
            lowLabel="Péssima"
            highLabel="Ótima"
          />
          <ScaleField
            label="Energia"
            value={energy}
            onChange={setEnergy}
            lowLabel="Exausto"
            highLabel="Muita"
          />
          <ScaleField
            label="Dor muscular"
            value={soreness}
            onChange={setSoreness}
            lowLabel="Nenhuma"
            highLabel="Muita"
          />
          <ScaleField
            label="Estresse"
            value={stress}
            onChange={setStress}
            lowLabel="Tranquilo"
            highLabel="Muito"
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Peso (opcional)</span>
            <input
              value={weightKg}
              onChange={(event) => setWeight(event.target.value)}
              inputMode="decimal"
              placeholder="kg"
              className="min-h-touch rounded-field border border-border bg-surface-sunken px-3 text-base text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Observações (opcional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="rounded-field border border-border bg-surface-sunken p-3 text-base text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>

          {mutation.isError ? (
            <Alert variant="error">{problemMessage(mutation.error)}</Alert>
          ) : null}

          <Button size="xl" loading={mutation.isPending} onClick={handleSubmit}>
            {current.data ? 'Atualizar check-in' : 'Enviar check-in'}
          </Button>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Semanas anteriores</h2>
        {history.isPending ? (
          <Skeleton className="h-20" />
        ) : (history.data?.items.length ?? 0) === 0 ? (
          <Card>
            <CardContent>
              <CardDescription>Ainda não há check-ins anteriores.</CardDescription>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.data!.items.map((item) => (
              <li key={item.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <CardTitle className="text-sm">{formatDate(item.weekStart)}</CardTitle>
                    <span className="text-sm text-text-muted">
                      {item.weightKg != null ? `${formatWeight(item.weightKg)} · ` : ''}
                      sono {item.sleepQuality ?? '—'}/5 · energia {item.energy ?? '—'}/5
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
