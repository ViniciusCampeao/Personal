import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { createProgram, listPrograms } from './programs-api';

/** Reusable programs (spec §8): a template has no student until it is duplicated. */
export function TemplatesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const templates = useQuery({
    queryKey: ['programs', { isTemplate: true }],
    queryFn: () => listPrograms({ isTemplate: true, limit: 50 }),
  });

  const create = useMutation({
    mutationFn: () => createProgram({ isTemplate: true, name: name.trim() }),
    meta: { silent: true },
    onSuccess: async () => {
      setName('');
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Templates</h1>
        <Button onClick={() => setCreating((open) => !open)}>
          {creating ? 'Fechar' : 'Novo template'}
        </Button>
      </header>

      {creating ? (
        <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
          <Field label="Nome do template">
            {(field) => (
              <Input {...field} value={name} onChange={(event) => setName(event.target.value)} />
            )}
          </Field>
          {create.isError ? <Alert variant="error">{problemMessage(create.error)}</Alert> : null}
          <Button
            loading={create.isPending}
            disabled={name.trim().length < 2}
            onClick={() => create.mutate()}
            className="self-start"
          >
            Criar
          </Button>
        </section>
      ) : null}

      {templates.isPending ? (
        <Skeleton className="h-40" />
      ) : templates.isError ? (
        <Alert variant="error">{problemMessage(templates.error)}</Alert>
      ) : templates.data.items.length === 0 ? (
        <Card>
          <CardContent>
            <CardDescription>
              Nenhum template ainda. Você também pode transformar qualquer programa em template pelo
              editor.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.data.items.map((template) => (
            <li key={template.id}>
              <Link
                to={PATHS.trainerProgram(template.id)}
                className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-4 py-3 hover:border-border-strong"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{template.name}</span>
                  <span className="text-xs text-text-subtle">
                    {template.goal ?? 'sem objetivo'} · criado em {formatDate(template.createdAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
