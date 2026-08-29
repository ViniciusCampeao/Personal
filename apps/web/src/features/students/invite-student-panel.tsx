import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import {
  createInviteSchema,
  type CreateInviteInput,
  type CreateInviteResponseDto,
} from '@pt/shared';
import type { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { withBlankAsUndefined } from '@/lib/form';
import { formatDate } from '@/lib/format';
import { applyProblemToForm } from '@/lib/problem';

/**
 * Creating an invite hands back a link and a QR code. The trainer usually has the
 * student in front of them, which is what the QR is for; the link is for WhatsApp.
 */
/** `expiresInDays` has a schema default, so the form is typed on the input side. */
type InviteFormValues = z.input<typeof createInviteSchema>;

export function InviteStudentPanel({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [created, setCreated] = useState<CreateInviteResponseDto | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: withBlankAsUndefined(zodResolver(createInviteSchema), ['email', 'phone']),
    defaultValues: { expiresInDays: 7 },
  });

  const create = useMutation({
    mutationFn: (input: CreateInviteInput) =>
      apiFetch<CreateInviteResponseDto>('/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    meta: { silent: true },
    onSuccess: setCreated,
    onError: (error) => applyProblemToForm(error, setError, ['email', 'phone']),
  });

  // A blank optional input arrives as `''`, which the schema reads as an invalid
  // address rather than as "not informed".
  const onSubmit = handleSubmit((values) =>
    create.mutate({
      expiresInDays: values.expiresInDays ?? 7,
      ...(values.email ? { email: values.email } : {}),
      ...(values.phone ? { phone: values.phone } : {}),
    }),
  );

  if (created) {
    return (
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
        <h2 className="text-base font-semibold">Convite criado</h2>
        <p className="text-sm text-text-muted">
          Válido até {formatDate(created.expiresAt)}. Mostre o QR code ou envie o link.
        </p>
        <img
          src={created.qrCodeDataUrl}
          alt="QR code do convite"
          className="size-40 self-start rounded-lg bg-white p-2"
        />
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-sunken px-3 py-2 text-xs">
            {created.url}
          </code>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(created.url);
              toast('Link copiado.', 'success');
            }}
          >
            Copiar link
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setCreated(null)}>
            Criar outro
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Concluir
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface-raised p-4"
      noValidate
    >
      <h2 className="text-base font-semibold">Convidar aluno</h2>
      <p className="text-sm text-text-muted">
        Informe o e-mail ou o telefone. O aluno cria a própria senha ao aceitar.
      </p>

      {errors.root?.serverError ? (
        <Alert variant="error">{errors.root.serverError.message}</Alert>
      ) : null}

      <Field label="E-mail" error={errors.email?.message}>
        {(field) => (
          <Input
            {...field}
            {...register('email')}
            type="email"
            autoComplete="off"
            inputMode="email"
          />
        )}
      </Field>

      <Field label="Telefone" error={errors.phone?.message}>
        {(field) => <Input {...field} {...register('phone')} type="tel" inputMode="tel" />}
      </Field>

      <Field label="Validade (dias)" error={errors.expiresInDays?.message}>
        {(field) => (
          <Input
            {...field}
            {...register('expiresInDays', { valueAsNumber: true })}
            inputMode="numeric"
          />
        )}
      </Field>

      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting || create.isPending}>
          Gerar convite
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
