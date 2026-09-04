import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeDay } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { PageHeader } from '@/components/app/page-header';
import { fetchNotifications, markNotificationRead } from './notifications-api';
import { PushToggle } from './push-toggle';
import { notificationKeys } from './use-notifications';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationKeys.list,
    queryFn: () => fetchNotifications({ limit: 50 }),
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: notificationKeys.list }),
        queryClient.invalidateQueries({ queryKey: notificationKeys.unread }),
      ]);
    },
  });

  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Notificações"
        description="Avisos do seu treinador e lembretes de treino."
      />

      <PushToggle />

      {query.isPending ? (
        <Skeleton className="h-40" />
      ) : query.isError ? (
        <Alert variant="error">{problemMessage(query.error)}</Alert>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <CardDescription>Nada por aqui ainda.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => !item.readAt && markRead.mutate(item.id)}
                className={`flex w-full flex-col gap-1 rounded-card border p-4 text-left ${
                  item.readAt ? 'border-border bg-surface-raised' : 'border-accent/40 bg-accent/5'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.title}</span>
                  <span className="shrink-0 text-xs text-text-subtle">
                    {formatRelativeDay(item.createdAt)}
                  </span>
                </span>
                <span className="text-sm text-text-muted">{item.body}</span>
                {!item.readAt ? (
                  <span className="text-xs text-accent">Toque para marcar como lida</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
