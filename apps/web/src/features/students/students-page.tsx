import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { StudentSummaryDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounced } from '@/hooks/use-debounced';
import { formatRelativeDay } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { PageHeader } from '@/components/app/page-header';
import { segmentedClass } from '@/components/ui/segmented';
import { InviteStudentPanel } from './invite-student-panel';
import { listStudents, type StudentFilters } from './students-api';

const STATUS_LABELS: Record<StudentSummaryDto['status'], string> = {
  ACTIVE: 'Ativo',
  PENDING: 'Convite pendente',
  PAUSED: 'Pausado',
  ARCHIVED: 'Arquivado',
};

const QUICK_FILTERS = [
  { key: 'all', label: 'Todos', filters: {} as StudentFilters },
  { key: 'inactive', label: 'Sem treinar há 10 dias', filters: { inactiveDays: 10 } },
  { key: 'low', label: 'Aderência abaixo de 60%', filters: { maxAdherencePct: 60 } },
  { key: 'paused', label: 'Pausados', filters: { status: 'PAUSED' as const } },
] as const;

export function StudentsPage() {
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<(typeof QUICK_FILTERS)[number]['key']>('all');
  const [inviting, setInviting] = useState(false);
  const debouncedSearch = useDebounced(search, 300);

  const filters: StudentFilters = {
    ...QUICK_FILTERS.find((item) => item.key === quick)!.filters,
    ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
  };

  const query = useQuery({
    queryKey: ['students', filters],
    queryFn: () => listStudents(filters, { limit: 50 }),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Alunos"
        description="Quem você acompanha hoje, e há quanto tempo cada um não treina."
        actions={
          <Button onClick={() => setInviting((open) => !open)}>
            {inviting ? 'Fechar' : 'Convidar aluno'}
          </Button>
        }
      />

      {inviting ? <InviteStudentPanel onDone={() => setInviting(false)} /> : null}

      <div className="flex flex-col gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar aluno"
          type="search"
        />
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={quick === item.key}
              onClick={() => setQuick(item.key)}
              className={segmentedClass(quick === item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? (
        <Skeleton className="h-64" />
      ) : query.isError ? (
        <Alert variant="error">{problemMessage(query.error)}</Alert>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <CardDescription>
              {debouncedSearch || quick !== 'all'
                ? 'Nenhum aluno com esses critérios.'
                : 'Convide seu primeiro aluno para começar.'}
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <StudentTable items={items} />
      )}
    </div>
  );
}

function StudentTable({ items }: { items: StudentSummaryDto[] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised shadow-card">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-text-subtle">
          <tr>
            <th className="px-4 py-3 font-medium">Aluno</th>
            <th className="px-4 py-3 font-medium">Programa</th>
            <th className="px-4 py-3 font-medium">Último treino</th>
            <th className="px-4 py-3 font-medium">Aderência</th>
            <th className="px-4 py-3 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((student) => (
            <tr key={student.id} className="transition-colors hover:bg-white/[0.03]">
              <td className="px-4 py-3">
                <Link to={PATHS.trainerStudent(student.id)} className="flex items-center gap-3">
                  <Avatar name={student.name} size="sm" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-text">{student.name}</span>
                    <span className="truncate text-xs text-text-subtle">{student.email}</span>
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 text-text-muted">
                {student.activeProgramName ?? <span className="text-warning">Sem programa</span>}
              </td>
              <td className="px-4 py-3 tabular-nums text-text-muted">
                {student.lastSessionAt ? formatRelativeDay(student.lastSessionAt) : 'Nunca'}
              </td>
              <td className="px-4 py-3">
                <AdherenceCell ratio={student.adherenceRatio} />
              </td>
              <td className="px-4 py-3 text-text-muted">
                {STATUS_LABELS[student.status]}
                {student.hasPendingCheckIn ? (
                  <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
                    check-in pendente
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Colour is doubled by the number itself — never the only carrier of the meaning. */
function AdherenceCell({ ratio }: { ratio: number }) {
  const pct = Math.round(ratio * 100);
  const tone = pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-danger';
  return <span className={`font-medium tabular-nums ${tone}`}>{pct}%</span>;
}
