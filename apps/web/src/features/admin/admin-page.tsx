import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { TenantBrandingCard } from '@/features/tenant/tenant-branding-card';
import { fetchAdminUsers, fetchAuditLog } from './admin-api';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  TRAINER: 'Treinador',
  STUDENT: 'Aluno',
};

export function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Administração</h1>
      <TenantBrandingCard />
      <UsersCard />
      <AuditLogCard />
    </div>
  );
}

function UsersCard() {
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: fetchAdminUsers });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <CardTitle>Usuários</CardTitle>
        {users.isPending ? (
          <Skeleton className="h-32" />
        ) : users.isError ? (
          <Alert variant="error">{problemMessage(users.error)}</Alert>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.data!.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <CardDescription>{user.email}</CardDescription>
                </div>
                <span className="text-text-muted">
                  {ROLE_LABELS[user.role] ?? user.role} · {user.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AuditLogCard() {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const log = useQuery({
    queryKey: ['admin', 'audit-log', cursor],
    queryFn: () => fetchAuditLog(cursor),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <CardTitle>Log de auditoria</CardTitle>
        <CardDescription>
          Acessos a dados sensíveis (anamnese, atestado, foto) por quem não é o titular.
        </CardDescription>
        {log.isPending ? (
          <Skeleton className="h-32" />
        ) : log.isError ? (
          <Alert variant="error">{problemMessage(log.error)}</Alert>
        ) : log.data!.items.length === 0 ? (
          <CardDescription>Nenhum registro ainda.</CardDescription>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {log.data!.items.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <span className="font-medium">{entry.actorName ?? 'sistema'}</span>{' '}
                  <span className="text-text-muted">
                    {entry.action} · {entry.entity} · {formatDateTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
            {log.data!.nextCursor ? (
              <Button size="sm" variant="secondary" onClick={() => setCursor(log.data!.nextCursor!)}>
                Carregar mais
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
