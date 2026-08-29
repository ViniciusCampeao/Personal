import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calculateBodyComposition,
  CalcValidationError,
  requiredSkinfoldSites,
  protocolRequiresAge,
  skinfoldProtocols,
  type AssessmentDetailDto,
  type CreateAssessmentInput,
  type SkinfoldSite,
  type SkinfoldProtocol,
} from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { formatPercent, formatWeight, todayInSaoPaulo } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { fetchStudent } from '@/features/students/students-api';

const PROTOCOL_LABELS: Record<SkinfoldProtocol, string> = {
  NONE: 'Sem dobras',
  POLLOCK_3: 'Pollock 3 dobras',
  POLLOCK_7: 'Pollock 7 dobras',
  GUEDES: 'Guedes',
  FAULKNER: 'Faulkner',
};

const SKINFOLD_LABELS: Record<SkinfoldSite, string> = {
  TRICEPS: 'Tríceps',
  SUBSCAPULAR: 'Subescapular',
  CHEST: 'Peitoral',
  MIDAXILLARY: 'Axilar média',
  SUPRAILIAC: 'Supra-ilíaca',
  ABDOMINAL: 'Abdominal',
  THIGH: 'Coxa',
};

const MEASUREMENT_SITES = [
  ['NECK', 'Pescoço'],
  ['CHEST', 'Tórax'],
  ['WAIST', 'Cintura'],
  ['ABDOMEN', 'Abdômen'],
  ['HIP', 'Quadril'],
  ['ARM_R', 'Braço direito'],
  ['ARM_L', 'Braço esquerdo'],
  ['THIGH_R', 'Coxa direita'],
  ['THIGH_L', 'Coxa esquerda'],
  ['CALF_R', 'Panturrilha direita'],
  ['CALF_L', 'Panturrilha esquerda'],
] as const;

function toNumber(value: string): number | undefined {
  const parsed = Number(value.replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * New physical assessment (spec §7). The body composition is recomputed on every
 * keystroke with the *same* `@pt/shared/calc` functions the API uses to persist it — so
 * what the trainer sees while typing is the number that will be stored, never an
 * approximation that drifts from the server's.
 */
export function AssessmentFormPage() {
  const { id: studentId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const student = useQuery({
    queryKey: ['students', studentId, 'detail'],
    queryFn: () => fetchStudent(studentId),
  });

  const [assessedAt, setAssessedAt] = useState(todayInSaoPaulo());
  const [protocol, setProtocol] = useState<SkinfoldProtocol>('NONE');
  const [weightKg, setWeight] = useState('');
  const [heightCm, setHeight] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [notes, setNotes] = useState('');
  const [skinfolds, setSkinfolds] = useState<Record<string, string>>({});
  const [measurements, setMeasurements] = useState<Record<string, string>>({});

  const sex = student.data?.sex ?? null;
  const ageYears = useMemo(() => {
    if (!student.data?.birthDate) return null;
    const birth = new Date(student.data.birthDate);
    const now = new Date(assessedAt);
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
    return age;
  }, [student.data?.birthDate, assessedAt]);

  const sites = sex ? requiredSkinfoldSites(protocol, sex) : [];

  // Mirrors what the API will compute; a `CalcValidationError` here is the honest "not
  // enough data yet" state, not a failure to report.
  const preview = useMemo(() => {
    if (!sex) return null;
    try {
      return calculateBodyComposition({
        protocol,
        sex,
        ageYears,
        weightKg: toNumber(weightKg) ?? null,
        heightCm: toNumber(heightCm) ?? student.data?.heightCm ?? null,
        skinfoldsMm: Object.fromEntries(
          Object.entries(skinfolds)
            .map(([site, value]) => [site, toNumber(value)])
            .filter(([, value]) => value != null),
        ) as Partial<Record<SkinfoldSite, number>>,
      });
    } catch (error) {
      return error instanceof CalcValidationError ? null : null;
    }
  }, [protocol, sex, ageYears, weightKg, heightCm, skinfolds, student.data?.heightCm]);

  const create = useMutation({
    mutationFn: (input: CreateAssessmentInput) =>
      apiFetch<AssessmentDetailDto>(`/students/${studentId}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    meta: { silent: true },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['students', studentId] });
      toast('Avaliação registrada.', 'success');
      navigate(`/gestao/avaliacoes/${saved.id}`, { replace: true });
    },
  });

  if (student.isPending) return <Skeleton className="h-96" />;
  if (student.isError) return <Alert variant="error">{problemMessage(student.error)}</Alert>;

  const missingSexForProtocol = protocol !== 'NONE' && !sex;
  const missingAge = protocolRequiresAge(protocol) && ageYears == null;

  function handleSubmit() {
    const skinfoldsMm = Object.fromEntries(
      sites
        .map((site) => [site, toNumber(skinfolds[site] ?? '')])
        .filter(([, value]) => value != null),
    ) as Record<string, number>;
    const measurementsCm = Object.fromEntries(
      MEASUREMENT_SITES.map(([site]) => [site, toNumber(measurements[site] ?? '')]).filter(
        ([, value]) => value != null,
      ),
    ) as Record<string, number>;

    create.mutate({
      assessedAt: new Date(`${assessedAt}T12:00:00.000Z`),
      protocol,
      ...(toNumber(weightKg) != null ? { weightKg: toNumber(weightKg) } : {}),
      ...(toNumber(heightCm) != null ? { heightCm: toNumber(heightCm) } : {}),
      ...(toNumber(restingHr) != null ? { restingHr: toNumber(restingHr) } : {}),
      ...(bloodPressure.trim() ? { bloodPressure: bloodPressure.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(Object.keys(skinfoldsMm).length > 0 ? { skinfoldsMm } : {}),
      ...(Object.keys(measurementsCm).length > 0 ? { measurementsCm } : {}),
    } as CreateAssessmentInput);
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Nova avaliação</h1>
          <p className="text-sm text-text-muted">{student.data.name}</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data">
            {(field) => (
              <Input
                {...field}
                type="date"
                value={assessedAt}
                onChange={(e) => setAssessedAt(e.target.value)}
              />
            )}
          </Field>

          <Field label="Protocolo">
            {(field) => (
              <select
                {...field}
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as SkinfoldProtocol)}
                className="min-h-touch rounded-lg border border-border bg-surface-sunken px-3 text-base text-text"
              >
                {skinfoldProtocols.map((option) => (
                  <option key={option} value={option}>
                    {PROTOCOL_LABELS[option]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Peso (kg)">
            {(field) => (
              <Input
                {...field}
                value={weightKg}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
              />
            )}
          </Field>

          <Field
            label="Altura (cm)"
            hint={student.data.heightCm ? 'Em branco usa a do cadastro.' : undefined}
          >
            {(field) => (
              <Input
                {...field}
                value={heightCm}
                onChange={(e) => setHeight(e.target.value)}
                inputMode="decimal"
              />
            )}
          </Field>

          <Field label="FC de repouso">
            {(field) => (
              <Input
                {...field}
                value={restingHr}
                onChange={(e) => setRestingHr(e.target.value)}
                inputMode="numeric"
              />
            )}
          </Field>

          <Field label="Pressão arterial">
            {(field) => (
              <Input
                {...field}
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                placeholder="120/80"
              />
            )}
          </Field>
        </div>

        {missingSexForProtocol ? (
          <Alert variant="warning">
            O protocolo precisa do sexo do aluno, que ainda não está no cadastro. Peça para ele
            preencher no perfil, ou registre a avaliação sem dobras.
          </Alert>
        ) : null}

        {missingAge ? (
          <Alert variant="warning">
            {PROTOCOL_LABELS[protocol]} usa a idade, e o aluno não tem data de nascimento
            cadastrada.
          </Alert>
        ) : null}

        {sites.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Dobras cutâneas (mm)</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {sites.map((site) => (
                <Field key={site} label={SKINFOLD_LABELS[site]}>
                  {(field) => (
                    <Input
                      {...field}
                      value={skinfolds[site] ?? ''}
                      onChange={(e) =>
                        setSkinfolds((current) => ({ ...current, [site]: e.target.value }))
                      }
                      inputMode="decimal"
                    />
                  )}
                </Field>
              ))}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Circunferências (cm)</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MEASUREMENT_SITES.map(([site, label]) => (
              <Field key={site} label={label}>
                {(field) => (
                  <Input
                    {...field}
                    value={measurements[site] ?? ''}
                    onChange={(e) =>
                      setMeasurements((current) => ({ ...current, [site]: e.target.value }))
                    }
                    inputMode="decimal"
                  />
                )}
              </Field>
            ))}
          </div>
        </section>

        <Field label="Observações">
          {(field) => (
            <textarea
              {...field}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-lg border border-border bg-surface-sunken p-3 text-base text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            />
          )}
        </Field>

        {create.isError ? <Alert variant="error">{problemMessage(create.error)}</Alert> : null}

        <div className="flex gap-2">
          <Button loading={create.isPending} onClick={handleSubmit}>
            Salvar avaliação
          </Button>
          <Button variant="ghost" onClick={() => navigate(PATHS.trainerStudent(studentId))}>
            Cancelar
          </Button>
        </div>
      </div>

      <Card className="lg:sticky lg:top-20">
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Resultado</h2>
          <p className="text-xs text-text-subtle">
            Calculado com as mesmas fórmulas que o servidor usa para gravar.
          </p>
          <dl className="flex flex-col gap-2 text-sm">
            <Result
              label="Soma das dobras"
              value={preview?.sumMm != null ? `${preview.sumMm.toFixed(1)} mm` : '—'}
            />
            <Result
              label="% de gordura"
              value={preview?.bodyFatPct != null ? formatPercent(preview.bodyFatPct) : '—'}
            />
            <Result
              label="Massa gorda"
              value={preview?.fatMassKg != null ? formatWeight(preview.fatMassKg) : '—'}
            />
            <Result
              label="Massa magra"
              value={preview?.leanMassKg != null ? formatWeight(preview.leanMassKg) : '—'}
            />
            <Result label="IMC" value={preview?.bmi != null ? preview.bmi.toFixed(1) : '—'} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
