import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CommentThread } from '@/components/app/comment-thread';
import { problemMessage } from '@/lib/problem';
import { useAuth } from '@/features/auth/auth-context';
import { addDietComment, fetchDietComments, fetchMyActiveDietPlan } from './diet-api';

const DIET_KEY = ['me', 'diet-plan'];

export function StudentDietPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const plan = useQuery({ queryKey: DIET_KEY, queryFn: fetchMyActiveDietPlan });
  const comments = useQuery({
    queryKey: ['diet-plans', plan.data?.id, 'comments'],
    enabled: Boolean(plan.data?.id),
    queryFn: () => fetchDietComments(plan.data!.id),
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => addDietComment(plan.data!.id, { body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['diet-plans', plan.data?.id, 'comments'] }),
  });

  if (plan.isPending) return <Skeleton className="h-64" />;
  if (plan.isError) return <Alert variant="error">{problemMessage(plan.error)}</Alert>;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold">Dieta</h1>
      </header>

      {!plan.data ? (
        <Card>
          <CardContent>
            <CardDescription>Seu treinador ainda não montou uma dieta para você.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <CardTitle>{plan.data.title}</CardTitle>
              {plan.data.goal ? <CardDescription>{plan.data.goal}</CardDescription> : null}
              {plan.data.notes ? <p className="text-sm text-text-muted">{plan.data.notes}</p> : null}
            </CardContent>
          </Card>

          <ul className="flex flex-col gap-3">
            {plan.data.meals.map((meal) => (
              <li key={meal.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>{meal.name}</CardTitle>
                      {meal.time ? <span className="text-sm text-text-muted">{meal.time}</span> : null}
                    </div>
                    <ul className="flex flex-col gap-1 text-sm text-text-muted">
                      {meal.items.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Comentários</h2>
            <CommentThread
              comments={comments.data ?? []}
              currentUserId={user?.id}
              submitting={commentMutation.isPending}
              error={commentMutation.error}
              onSubmit={(body) => commentMutation.mutate(body)}
              placeholder="Uma dúvida ou observação sobre a dieta…"
            />
          </section>
        </>
      )}
    </div>
  );
}
