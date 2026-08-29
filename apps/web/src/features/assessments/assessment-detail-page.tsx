import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import type { AssessmentDetailDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatDate,
  formatLength,
  formatPercent,
  formatSkinfold,
  formatWeight,
} from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { BackLink } from '@/components/app/back-link';
import { PhotoCompare } from './components/photo-compare';
import { compareAssessments, fetchAssessment, fetchAssessments } from './assessments-api';

const SKINFOLD_LABELS: Record<string, string> = {
  TRICEPS: 'Tríceps',
  SUBSCAPULAR: 'Subescapular',
  CHEST: 'Peitoral',
  MIDAXILLARY: 'Axilar média',
  SUPRAILIAC: 'Supra-ilíaca',
  ABDOMINAL: 'Abdominal',
  THIGH: 'Coxa',
};

const SITE_LABELS: Record<string, string> = {
  NECK: 'Pescoço',
  CHEST: 'Tórax',
  WAIST: 'Cintura',
  ABDOMEN: 'Abdômen',
  HIP: 'Quadril',
  ARM_R: 'Braço direito',
  ARM_L: 'Braço esquerdo',
  FOREARM_R: 'Antebraço direito',
  FOREARM_L: 'Antebraço esquerdo',
  THIGH_R: 'Coxa direita',
  THIGH_L: 'Coxa esquerda',
  CALF_R: 'Panturrilha direita',
  CALF_L: 'Panturrilha esquerda',
};

export function AssessmentDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();

  const assessment = useQuery({
    queryKey: ['assessments', id],
    queryFn: () => fetchAssessment(id),
  });

  // Comparing needs a second assessment; default to the one right before this. The
  // student id comes from the assessment itself, since this screen is opened both by the
  // student and by their trainer.
  const studentId = assessment.data?.studentId;
  const list = useQuery({
    queryKey: ['students', studentId, 'assessments'],
    enabled: Boolean(studentId),
    queryFn: () => fetchAssessments(studentId!, { limit: 50 }),
  });

  const items = list.data?.items ?? [];
  const currentIndex = items.findIndex((item) => item.id === id);
  const previousId = params.get('comparar') ?? items[currentIndex + 1]?.id ?? null;

  const comparison = useQuery({
    queryKey: ['assessments', 'compare', previousId, id],
    enabled: Boolean(previousId),
    queryFn: () => compareAssessments(previousId!, id),
  });

  if (assessment.isPending) return <Skeleton className="h-64" />;
  if (assessment.isError) return <Alert variant="error">{problemMessage(assessment.error)}</Alert>;

  const data = assessment.data;

  return (
    <div className="flex flex-col gap-5">
      <BackLink label="Voltar" />

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{formatDate(data.assessedAt)}</h1>
        {data.notes ? <p className="text-sm text-text-muted">{data.notes}</p> : null}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Peso" value={data.weightKg != null ? formatWeight(data.weightKg) : '—'} />
        <Metric
          label="Gordura"
          value={data.bodyFatPct != null ? formatPercent(data.bodyFatPct) : '—'}
        />
        <Metric
          label="Massa magra"
          value={data.leanMassKg != null ? formatWeight(data.leanMassKg) : '—'}
        />
        <Metric label="IMC" value={data.bmi != null ? data.bmi.toFixed(1) : '—'} />
      </div>

      {comparison.data ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">
            Desde {formatDate(comparison.data.a.assessedAt)}
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            <Delta label="Peso" value={comparison.data.diff.weightKg} unit="kg" />
            <Delta label="Gordura" value={comparison.data.diff.bodyFatPct} unit="%" lowerIsBetter />
            <Delta label="Massa magra" value={comparison.data.diff.leanMassKg} unit="kg" />
          </ul>
        </section>
      ) : null}

      {data.measurements.length > 0 ? (
        <MeasureList
          title="Circunferências"
          rows={data.measurements.map((row) => ({
            label: SITE_LABELS[row.site] ?? row.site,
            value: formatLength(row.valueCm),
          }))}
        />
      ) : null}

      {data.skinfolds.length > 0 ? (
        <MeasureList
          title="Dobras cutâneas"
          rows={data.skinfolds.map((row) => ({
            label: SKINFOLD_LABELS[row.site] ?? row.site,
            value: formatSkinfold(row.valueMm),
          }))}
        />
      ) : null}

      {comparison.data ? (
        <PhotoCompare before={comparison.data.a} after={comparison.data.b} />
      ) : (
        <PhotoGallery assessment={data} />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-3">
        <span className="text-xs uppercase tracking-wide text-text-subtle">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}

function Delta({
  label,
  value,
  unit,
  lowerIsBetter = false,
}: {
  label: string;
  value: number | null;
  unit: string;
  lowerIsBetter?: boolean;
}) {
  if (value == null) return null;
  const improved = lowerIsBetter ? value < 0 : value > 0;
  const tone = value === 0 ? 'text-text-muted' : improved ? 'text-success' : 'text-warning';

  return (
    <li className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={`font-medium tabular-nums ${tone}`}>
        {value > 0 ? '+' : ''}
        {value.toFixed(1)} {unit}
      </span>
    </li>
  );
}

function MeasureList({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map((row) => (
          <li key={row.label} className="flex justify-between">
            <span className="text-text-muted">{row.label}</span>
            <span className="tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PhotoGallery({ assessment }: { assessment: AssessmentDetailDto }) {
  if (assessment.photos.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">Fotos</h2>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4">
        {assessment.photos.map((photo) => (
          <li key={photo.id} className="w-48 shrink-0">
            <img
              src={photo.url}
              alt={`Foto de ${formatDate(photo.takenAt)}`}
              className="w-full rounded-card border border-border"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
