import { useMemo } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { z } from 'zod';
import { acceptInviteSchema, type AcceptInviteInput, type InvitePreviewDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import { withBlankAsUndefined } from '@/lib/form';
import { applyProblemToForm, problemMessage } from '@/lib/problem';
import { useAuth } from '@/features/auth/auth-context';
import { PATHS } from '@/routes/paths';
import { acceptInvite, fetchInvitePreview } from './invites-api';

/**
 * `acceptInviteSchema` types the consents as `z.literal(true)`, so the *output* type
 * can't represent an unchecked box. The form is typed on the input side and cast once,
 * after validation has proven both are true.
 */
type AcceptInviteFormValues = z.input<typeof acceptInviteSchema>;

export function AcceptInvitePage() {
  const { token = '' } = useParams();

  const preview = useQuery({
    queryKey: ['invite', token],
    queryFn: () => fetchInvitePreview(token),
    retry: false,
  });

  if (preview.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }

  if (preview.isError) {
    // The API already says whether it expired or was used — show its wording, not ours.
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Convite indisponível</h1>
        <Alert variant="error">{problemMessage(preview.error)}</Alert>
        <Link to={PATHS.login} className="text-sm text-accent underline">
          Ir para o login
        </Link>
      </div>
    );
  }

  // Keyed on the token so the form state is rebuilt — never carried over — if the
  // preview is refetched for a different invite.
  return <AcceptInviteForm key={token} token={token} invite={preview.data} />;
}

/**
 * Split from the page on purpose: the form's `defaultValues` come from the invite, and
 * react-hook-form reads those once, when the hook first runs. Mounting the form only
 * after the preview resolved is what lets the invited e-mail be its initial value.
 */
function AcceptInviteForm({ token, invite }: { token: string; invite: InvitePreviewDto }) {
  const { adoptSession } = useAuth();
  const navigate = useNavigate();

  // The server keeps the invited address (`invite.email ?? input.email`), so offering it
  // as editable would be a lie.
  const emailLocked = Boolean(invite.email);

  const resolver = useMemo<Resolver<AcceptInviteFormValues>>(() => {
    // Login is always by e-mail, so a phone-only invite has to collect one. Checking it
    // here beats the 409 the API would answer with ("Informe um e-mail para concluir").
    const schema = emailLocked
      ? acceptInviteSchema
      : acceptInviteSchema.refine((values) => Boolean(values.email), {
          message: 'Informe seu e-mail.',
          path: ['email'],
        });
    return withBlankAsUndefined(zodResolver(schema), ['email', 'phone']);
  }, [emailLocked]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInviteFormValues>({
    resolver,
    defaultValues: {
      name: '',
      email: invite.email ?? '',
      phone: invite.phone ?? '',
      password: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await acceptInvite(token, values as AcceptInviteInput);
      adoptSession(session);
      navigate(PATHS.studentHome, { replace: true });
    } catch (error) {
      applyProblemToForm(error, setError, ['name', 'email', 'phone', 'password']);
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Criar sua conta</h1>
        <p className="text-sm text-text-muted">
          {invite.trainerName} convidou você para treinar na {invite.tenantName}.
        </p>
        <p className="text-xs text-text-subtle">
          Convite válido até {formatDate(invite.expiresAt)}.
        </p>
      </div>

      {errors.root?.serverError ? (
        <Alert variant="error">{errors.root.serverError.message}</Alert>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Nome" error={errors.name?.message}>
          {(field) => <Input {...field} {...register('name')} autoComplete="name" />}
        </Field>

        <Field
          label="E-mail"
          error={errors.email?.message}
          hint={emailLocked ? 'Definido pelo convite.' : undefined}
        >
          {(field) => (
            <Input
              {...field}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              readOnly={emailLocked}
            />
          )}
        </Field>

        <Field label="Telefone (opcional)" error={errors.phone?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
            />
          )}
        </Field>

        <Field label="Senha" error={errors.password?.message} hint="Mínimo de 8 caracteres.">
          {(field) => (
            <Input
              {...field}
              {...register('password')}
              type="password"
              autoComplete="new-password"
            />
          )}
        </Field>

        {/* LGPD §10.1: terms and privacy are accepted separately, never in one box. */}
        <div className="flex flex-col gap-3">
          <Checkbox {...register('consents.terms')} error={errors.consents?.terms?.message}>
            Li e aceito os{' '}
            <Link to={PATHS.terms} target="_blank" className="text-accent underline">
              Termos de Uso
            </Link>
            .
          </Checkbox>

          <Checkbox {...register('consents.privacy')} error={errors.consents?.privacy?.message}>
            Li e aceito a{' '}
            <Link to={PATHS.privacy} target="_blank" className="text-accent underline">
              Política de Privacidade
            </Link>
            .
          </Checkbox>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          Criar conta
        </Button>
      </form>
    </div>
  );
}
