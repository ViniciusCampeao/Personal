import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ExerciseDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/cn';
import { formatWeight } from '@/lib/format';
import { TECHNIQUE_LABELS, labelOf } from '@/lib/labels';
import type { LocalSession, LocalSessionExercise, LocalSet } from '@/lib/db';
import { PATHS } from '@/routes/paths';
import { useSyncStatus } from '@/features/sync/use-sync';
import { FinishPanel } from './components/finish-panel';
import { NumberField } from './components/number-field';
import { RestTimer } from './components/rest-timer';
import { SubstitutePanel } from './components/substitute-panel';
import { formatRest, formatSetTarget, restSecondsFor, summarizePrescription } from './prescription';
import { useLocalSets, useLocalSession } from './use-workouts';
import { finishSession, logSet, substituteExercise, undoSet } from './workout-store';

type Panel = 'none' | 'substitute' | 'finish';

export function WorkoutExecutionPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const session = useLocalSession(id);
  const sets = useLocalSets(id);

  if (session === undefined || sets === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy="true">
        <Spinner className="size-6 text-text-muted" />
        <span className="sr-only">Carregando treino…</span>
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Alert variant="error">Este treino não está mais neste dispositivo.</Alert>
        <Button onClick={() => navigate(PATHS.studentHome, { replace: true })}>
          Voltar ao início
        </Button>
      </div>
    );
  }

  return <ExecutionScreen session={session} sets={sets} />;
}

function ExecutionScreen({ session, sets }: { session: LocalSession; sets: LocalSet[] }) {
  const navigate = useNavigate();
  const { pending } = useSyncStatus();
  const [index, setIndex] = useState(0);
  const [panel, setPanel] = useState<Panel>('none');
  const [rest, setRest] = useState<{ startedAt: number; seconds: number } | null>(null);

  const exercises = session.exercises;
  const exercise = exercises[Math.min(index, exercises.length - 1)];

  const setsByExercise = useMemo(() => {
    const map = new Map<string, LocalSet[]>();
    for (const set of sets) {
      const list = map.get(set.prescribedExerciseId) ?? [];
      list.push(set);
      map.set(set.prescribedExerciseId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.setNumber - b.setNumber);
    return map;
  }, [sets]);

  const totalPrescribed = exercises.reduce((total, item) => total + item.sets.length, 0);
  const remaining = Math.max(0, totalPrescribed - sets.length);

  if (!exercise) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Alert variant="warning">Este treino não tem exercícios prescritos.</Alert>
        <Button
          onClick={() => void handleFinish({ perceivedEffort: null, mood: null, notes: null })}
        >
          Encerrar
        </Button>
      </div>
    );
  }

  async function handleFinish(input: {
    perceivedEffort: number | null;
    mood: number | null;
    notes: string | null;
  }) {
    await finishSession(session.clientUuid, input);
    navigate(PATHS.studentHome, { replace: true });
  }

  async function handleSubstitute(replacement: ExerciseDto, reason: string | null) {
    await substituteExercise(
      session.clientUuid,
      exercise!.prescribedExerciseId,
      { exerciseId: replacement.id, exerciseName: replacement.name },
      reason,
    );
    setPanel('none');
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ExecutionHeader
        dayLabel={session.dayLabel}
        done={sets.length}
        total={totalPrescribed}
        pending={pending}
        onLeave={() => navigate(PATHS.studentHome)}
      />

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        {panel === 'substitute' ? (
          <SubstitutePanel
            exerciseId={exercise.exerciseId}
            exerciseName={exercise.exerciseName}
            onCancel={() => setPanel('none')}
            onConfirm={(replacement, reason) => void handleSubstitute(replacement, reason)}
          />
        ) : panel === 'finish' ? (
          <FinishPanel
            pendingSets={remaining}
            onCancel={() => setPanel('none')}
            onConfirm={(input) => void handleFinish(input)}
          />
        ) : (
          <>
            <ExerciseCard
              sessionClientUuid={session.clientUuid}
              exercise={exercise}
              logged={setsByExercise.get(exercise.prescribedExerciseId) ?? []}
              onSubstitute={() => setPanel('substitute')}
              onLogged={(seconds) =>
                setRest(seconds > 0 ? { startedAt: Date.now(), seconds } : null)
              }
            />

            {rest ? (
              <RestTimer
                startedAt={rest.startedAt}
                seconds={rest.seconds}
                onDismiss={() => setRest(null)}
              />
            ) : null}

            <ExerciseStrip
              exercises={exercises}
              current={index}
              setsByExercise={setsByExercise}
              onSelect={(next) => {
                setIndex(next);
                setRest(null);
              }}
            />

            <Button variant="secondary" onClick={() => setPanel('finish')} className="w-full">
              Finalizar treino
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ExecutionHeader({
  dayLabel,
  done,
  total,
  pending,
  onLeave,
}: {
  dayLabel: string | null;
  done: number;
  total: number;
  pending: number;
  onLeave: () => void;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold">{dayLabel ?? 'Treino'}</span>
          <span className="text-xs text-text-subtle">
            {done} de {total} séries
            {pending > 0 ? ` · ${pending} a sincronizar` : ''}
          </span>
        </div>
        <Button variant="ghost" onClick={onLeave}>
          Sair
        </Button>
      </div>
      <div
        className="h-1 bg-surface-sunken"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do treino"
      >
        <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </header>
  );
}

function ExerciseCard({
  sessionClientUuid,
  exercise,
  logged,
  onSubstitute,
  onLogged,
}: {
  sessionClientUuid: string;
  exercise: LocalSessionExercise;
  logged: LocalSet[];
  onSubstitute: () => void;
  onLogged: (restSeconds: number) => void;
}) {
  const nextSetNumber = logged.length + 1;
  const prescribed = exercise.sets[logged.length];
  const previous = logged[logged.length - 1];

  const [load, setLoad] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fills what the student most likely wants: what they just lifted, else what was
  // prescribed, else what they did the last time this exercise came up.
  useEffect(() => {
    const load0 = previous?.loadKg ?? prescribed?.targetLoadKg ?? exercise.lastPerformance?.loadKg;
    const reps0 = prescribed?.repsMax ?? prescribed?.repsMin ?? exercise.lastPerformance?.reps;
    setLoad(load0 != null ? String(load0) : '');
    setReps(reps0 != null ? String(reps0) : '');
    setRir(prescribed?.targetRir != null ? String(prescribed.targetRir) : '');
  }, [
    exercise.prescribedExerciseId,
    logged.length,
    prescribed,
    previous,
    exercise.lastPerformance,
  ]);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">{exercise.exerciseName}</h1>
          <Button variant="ghost" onClick={onSubstitute}>
            Trocar
          </Button>
        </div>
        <p className="text-sm text-text-muted">
          {summarizePrescription(exercise.sets)}
          {exercise.technique !== 'NORMAL'
            ? ` · ${labelOf(TECHNIQUE_LABELS, exercise.technique)}`
            : ''}
          {formatRest(exercise.restSeconds)
            ? ` · descanso ${formatRest(exercise.restSeconds)}`
            : ''}
        </p>
        {exercise.substitutedFrom ? (
          <p className="text-xs text-warning">
            No lugar de {exercise.substitutedFrom.exerciseName}
            {exercise.substitutedFrom.reason ? ` — ${exercise.substitutedFrom.reason}` : ''}
          </p>
        ) : null}
        {exercise.notes ? <p className="text-sm text-text-muted">{exercise.notes}</p> : null}
        {exercise.lastPerformance ? (
          <p className="text-xs text-text-subtle">
            Última vez: {formatWeight(exercise.lastPerformance.loadKg ?? 0)} ×{' '}
            {exercise.lastPerformance.reps ?? '—'}
          </p>
        ) : null}
      </header>

      <LoggedSets sets={logged} />

      <SetForm
        setNumber={nextSetNumber}
        target={formatSetTarget(prescribed)}
        load={load}
        reps={reps}
        rir={rir}
        saving={saving}
        onLoad={setLoad}
        onReps={setReps}
        onRir={setRir}
        onSubmit={async () => {
          setSaving(true);
          try {
            await logSet(sessionClientUuid, exercise.prescribedExerciseId, {
              setNumber: nextSetNumber,
              setType: prescribed?.setType ?? 'WORK',
              loadKg: toNumber(load),
              reps: toNumber(reps),
              rir: toNumber(rir),
            });
            onLogged(restSecondsFor(prescribed, exercise.restSeconds));
          } finally {
            setSaving(false);
          }
        }}
      />
    </section>
  );
}

function toNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : null;
}

function LoggedSets({ sets }: { sets: LocalSet[] }) {
  if (sets.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1.5">
      {sets.map((set) => (
        <li
          key={set.clientUuid}
          className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-sm"
        >
          <span className="text-text-muted">Série {set.setNumber}</span>
          <span className="font-medium tabular-nums">
            {set.loadKg != null ? formatWeight(set.loadKg) : '—'} × {set.reps ?? '—'}
            {set.rir != null ? ` · RIR ${set.rir}` : ''}
          </span>
          <button
            type="button"
            onClick={() => void undoSet(set)}
            className="text-xs text-text-subtle underline"
          >
            Desfazer
          </button>
        </li>
      ))}
    </ul>
  );
}

function SetForm({
  setNumber,
  target,
  load,
  reps,
  rir,
  saving,
  onLoad,
  onReps,
  onRir,
  onSubmit,
}: {
  setNumber: number;
  target: string;
  load: string;
  reps: string;
  rir: string;
  saving: boolean;
  onLoad: (value: string) => void;
  onReps: (value: string) => void;
  onRir: (value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Série {setNumber}</h2>
        <span className="text-xs text-text-subtle">{target}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Carga" unit="kg" value={load} onChange={onLoad} step={2.5} />
        <NumberField label="Reps" value={reps} onChange={onReps} step={1} />
      </div>
      <NumberField label="RIR" value={rir} onChange={onRir} step={1} className="max-w-40" />

      <Button size="xl" loading={saving} onClick={() => void onSubmit()}>
        Registrar série
      </Button>
    </div>
  );
}

function ExerciseStrip({
  exercises,
  current,
  setsByExercise,
  onSelect,
}: {
  exercises: LocalSessionExercise[];
  current: number;
  setsByExercise: Map<string, LocalSet[]>;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Exercícios do treino" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {exercises.map((exercise, index) => {
          const done = setsByExercise.get(exercise.prescribedExerciseId)?.length ?? 0;
          const complete = done >= exercise.sets.length && exercise.sets.length > 0;
          return (
            <li key={exercise.prescribedExerciseId}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={index === current ? 'true' : undefined}
                className={cn(
                  'flex min-h-touch flex-col items-start whitespace-nowrap rounded-lg border px-3 py-2 text-left',
                  index === current
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-surface-raised',
                )}
              >
                <span className="max-w-40 truncate text-sm font-medium">
                  {exercise.exerciseName}
                </span>
                <span className={cn('text-xs', complete ? 'text-success' : 'text-text-subtle')}>
                  {done}/{exercise.sets.length} séries
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
