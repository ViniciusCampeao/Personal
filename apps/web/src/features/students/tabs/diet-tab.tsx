import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DietMealInput, DietPlanDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { CommentThread } from '@/components/app/comment-thread';
import { formatDateTime } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { useAuth } from '@/features/auth/auth-context';
import {
  addDietComment,
  createDietPlan,
  fetchDietComments,
  fetchDietPlansForStudent,
  updateDietPlan,
} from '@/features/diet/diet-api';
import { useStudent } from './use-student';

interface MealDraft {
  name: string;
  time: string;
  itemsText: string;
}

function toDraft(meal: { name: string; time: string | null; items: string[] }): MealDraft {
  return { name: meal.name, time: meal.time ?? '', itemsText: meal.items.join('\n') };
}

function emptyDraft(): MealDraft {
  return { name: '', time: '', itemsText: '' };
}

export function StudentDietTab() {
  const student = useStudent();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const plans = useQuery({
    queryKey: ['students', student.id, 'diet-plans'],
    queryFn: () => fetchDietPlansForStudent(student.id),
  });
  const activePlan = plans.data?.find((plan) => plan.active) ?? null;
  const previousPlans = plans.data?.filter((plan) => !plan.active) ?? [];

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [meals, setMeals] = useState<MealDraft[]>([emptyDraft()]);

  useEffect(() => {
    if (!activePlan) return;
    setTitle(activePlan.title);
    setGoal(activePlan.goal ?? '');
    setNotes(activePlan.notes ?? '');
    setMeals(activePlan.meals.length > 0 ? activePlan.meals.map(toDraft) : [emptyDraft()]);
  }, [activePlan]);

  const comments = useQuery({
    queryKey: ['diet-plans', activePlan?.id, 'comments'],
    enabled: Boolean(activePlan?.id),
    queryFn: () => fetchDietComments(activePlan!.id),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        goal: goal.trim() || undefined,
        notes: notes.trim() || undefined,
        meals: meals
          .filter((meal) => meal.name.trim() !== '')
          .map((meal): DietMealInput => ({
            name: meal.name.trim(),
            time: meal.time.trim() || undefined,
            items: meal.itemsText
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
          })),
      };
      return activePlan
        ? updateDietPlan(activePlan.id, payload)
        : createDietPlan(student.id, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['students', student.id, 'diet-plans'] });
      toast('Dieta salva.', 'success');
    },
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => addDietComment(activePlan!.id, { body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['diet-plans', activePlan?.id, 'comments'] }),
  });

  function updateMeal(index: number, patch: Partial<MealDraft>) {
    setMeals((current) => current.map((meal, i) => (i === index ? { ...meal, ...patch } : meal)));
  }

  function removeMeal(index: number) {
    setMeals((current) => current.filter((_, i) => i !== index));
  }

  if (plans.isPending) return <Skeleton className="h-64" />;
  if (plans.isError) return <Alert variant="error">{problemMessage(plans.error)}</Alert>;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <CardTitle>{activePlan ? 'Editar dieta ativa' : 'Nova dieta'}</CardTitle>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Título</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Dieta de cutting"
              className="min-h-touch rounded-field border border-border bg-surface-sunken px-3 text-base text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Objetivo (opcional)</span>
            <input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className="min-h-touch rounded-field border border-border bg-surface-sunken px-3 text-base text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">Refeições</span>
            {meals.map((meal, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-field border border-border p-3"
              >
                <div className="flex gap-2">
                  <input
                    value={meal.name}
                    onChange={(event) => updateMeal(index, { name: event.target.value })}
                    placeholder="Nome (ex.: Café da manhã)"
                    className="min-h-touch flex-1 rounded-field border border-border bg-surface-sunken px-3 text-base text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                  />
                  <input
                    value={meal.time}
                    onChange={(event) => updateMeal(index, { time: event.target.value })}
                    placeholder="Horário"
                    className="min-h-touch w-28 rounded-field border border-border bg-surface-sunken px-3 text-base text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                  />
                </div>
                <textarea
                  value={meal.itemsText}
                  onChange={(event) => updateMeal(index, { itemsText: event.target.value })}
                  rows={3}
                  placeholder={'Um item por linha, ex.:\n2 ovos\naveia 40g'}
                  className="rounded-field border border-border bg-surface-sunken p-3 text-sm text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start text-danger"
                  onClick={() => removeMeal(index)}
                >
                  Remover refeição
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              onClick={() => setMeals((current) => [...current, emptyDraft()])}
            >
              + Refeição
            </Button>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Observações gerais (opcional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="rounded-field border border-border bg-surface-sunken p-3 text-base text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>

          {saveMutation.isError ? (
            <Alert variant="error">{problemMessage(saveMutation.error)}</Alert>
          ) : null}

          <Button
            size="lg"
            className="self-start"
            loading={saveMutation.isPending}
            disabled={!title.trim()}
            onClick={() => saveMutation.mutate()}
          >
            Salvar dieta
          </Button>
        </CardContent>
      </Card>

      {activePlan ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Comentários</h2>
          <CommentThread
            comments={comments.data ?? []}
            currentUserId={user?.id}
            submitting={commentMutation.isPending}
            error={commentMutation.error}
            onSubmit={(body) => commentMutation.mutate(body)}
          />
        </section>
      ) : null}

      {previousPlans.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Dietas anteriores</h2>
          <ul className="flex flex-col gap-2">
            {previousPlans.map((plan: DietPlanDto) => (
              <li key={plan.id}>
                <Card>
                  <CardContent className="py-3">
                    <CardDescription>
                      {plan.title} · criada em {formatDateTime(plan.createdAt)}
                    </CardDescription>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
