import { useQuery } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatWeight } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { fetchCheckIns } from '@/features/checkins/checkins-api';
import { useStudent } from './use-student';

/** Colour is a hint; the "n/5" beside it is what actually carries the value. */
function Score({
  label,
  value,
  inverted = false,
}: {
  label: string;
  value: number | null;
  inverted?: boolean;
}) {
  if (value == null) return <span className="text-text-subtle">{label} —</span>;
  const good = inverted ? value <= 2 : value >= 4;
  const bad = inverted ? value >= 4 : value <= 2;
  const tone = good ? 'text-success' : bad ? 'text-warning' : 'text-text-muted';
  return (
    <span className={tone}>
      {label} {value}/5
    </span>
  );
}

export function StudentCheckInsTab() {
  const student = useStudent();
  const query = useQuery({
    queryKey: ['students', student.id, 'check-ins'],
    queryFn: () => fetchCheckIns(student.id, { limit: 50 }),
  });

  if (query.isPending) return <Skeleton className="h-48" />;
  if (query.isError) return <Alert variant="error">{problemMessage(query.error)}</Alert>;

  const items = query.data.items;
  if (items.length === 0) {
    return (
      <Card>
        <CardContent>
          <CardDescription>Nenhum check-in respondido ainda.</CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <Card>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Semana de {formatDate(item.weekStart)}</span>
                <span className="text-sm text-text-muted">
                  {item.weightKg != null ? formatWeight(item.weightKg) : '—'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <Score label="Sono" value={item.sleepQuality} />
                <Score label="Energia" value={item.energy} />
                <Score label="Dor" value={item.soreness} inverted />
                <Score label="Estresse" value={item.stress} inverted />
              </div>
              {item.notes ? <p className="text-sm text-text-muted">{item.notes}</p> : null}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
