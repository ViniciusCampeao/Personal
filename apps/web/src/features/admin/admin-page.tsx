import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { formatDateTime } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { fetchAdminUsers, fetchAuditLog, fetchTenant, updateTenant } from './admin-api';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  TRAINER: 'Treinador',
  STUDENT: 'Aluno',
};

export function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Administração</h1>
      <TenantCard />
      <UsersCard />
      <AuditLogCard />
    </div>
  );
}

function TenantCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const tenant = useQuery({ queryKey: ['admin', 'tenant'], queryFn: fetchTenant });
  const [name, setName] = useState('');

  useEffect(() => {
    if (tenant.data) setName(tenant.data.name);
  }, [tenant.data]);

  const mutation = useMutation({
    mutationFn: () => updateTenant({ name: name.trim() }),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['admin', 'tenant'], saved);
      toast('Dados salvos.', 'success');
    },
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <CardTitle>Academia / negócio</CardTitle>
        {tenant.isPending ? (
          <Skeleton className="h-10" />
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Nome</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-h-touch rounded-lg border border-border bg-surface-sunken px-3 text-base text-text"
              />
            </label>
            {mutation.isError ? (
              <Alert variant="error">{problemMessage(mutation.error)}</Alert>
            ) : null}
            <Button
              size="sm"
              className="self-start"
              loading={mutation.isPending}
              disabled={!name.trim() || name === tenant.data?.name}
              onClick={() => mutation.mutate()}
            >
              Salvar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
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
