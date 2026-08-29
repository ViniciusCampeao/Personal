import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatDate, formatPercent, formatWeight } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { fetchAssessments } from '@/features/assessments/assessments-api';
import { useStudent } from './use-student';

export function StudentAssessmentsTab() {
  const student = useStudent();
  const query = useQuery({
    queryKey: ['students', student.id, 'assessments'],
    queryFn: () => fetchAssessments(student.id, { limit: 50 }),
  });

  return (
    <div className="flex flex-col gap-4">
      <Link to="nova" className={cn(buttonVariants(), 'self-start')}>
        Nova avaliação
      </Link>

      {query.isPending ? (
        <Skeleton className="h-40" />
      ) : query.isError ? (
        <Alert variant="error">{problemMessage(query.error)}</Alert>
      ) : query.data.items.length === 0 ? (
        <Card>
          <CardContent>
            <CardDescription>Nenhuma avaliação registrada para este aluno.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {query.data.items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/gestao/avaliacoes/${item.id}`}
                className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-4 py-3 hover:border-border-strong"
              >
                <span className="text-sm font-medium">{formatDate(item.assessedAt)}</span>
                <span className="text-sm text-text-muted">
                  {item.weightKg != null ? formatWeight(item.weightKg) : '—'}
                  {item.bodyFatPct != null ? ` · ${formatPercent(item.bodyFatPct)}` : ''}
                  {item.bmi != null ? ` · IMC ${item.bmi.toFixed(1)}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
