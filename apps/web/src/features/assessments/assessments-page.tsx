import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatPercent, formatWeight } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { useAuth } from '@/features/auth/auth-context';
import { fetchAssessments } from './assessments-api';

/** Timeline of the physical assessments the trainer recorded (spec §8). */
export function AssessmentsPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['students', user?.id, 'assessments'],
    enabled: Boolean(user?.id),
    queryFn: () => fetchAssessments(user!.id, { limit: 50 }),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Avaliações</h1>

      {query.isPending ? (
        <Skeleton className="h-40" />
      ) : query.isError ? (
        <Alert variant="error">{problemMessage(query.error)}</Alert>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <CardDescription>
              Suas avaliações físicas aparecem aqui depois da primeira medição.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((item, index) => (
            <li key={item.id} className="relative pl-5">
              {/* A timeline rail: each assessment reads as a point in a sequence. */}
              <span
                aria-hidden="true"
                className="absolute left-0 top-5 size-2 rounded-full bg-accent"
              />
              {index < items.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[3px] top-7 w-px bg-border"
                />
              ) : null}
              <Link
                to={`/app/avaliacoes/${item.id}`}
                className="block rounded-card border border-border bg-surface-raised p-4 active:bg-surface-sunken"
              >
                <p className="text-sm font-semibold">{formatDate(item.assessedAt)}</p>
                <p className="mt-1 text-sm text-text-muted">
                  {item.weightKg != null ? formatWeight(item.weightKg) : 'peso —'}
                  {item.bodyFatPct != null ? ` · ${formatPercent(item.bodyFatPct)} de gordura` : ''}
                  {item.bmi != null ? ` · IMC ${item.bmi.toFixed(1)}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
