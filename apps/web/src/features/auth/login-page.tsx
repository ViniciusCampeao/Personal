import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isApiError, problemMessage } from '@/lib/problem';
import { homePathFor } from '@/routes/paths';
import { useAuth } from './auth-context';

function loginErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    // The throttler allows 5 attempts per minute (see AuthController).
    if (error.status === 429) return 'Muitas tentativas. Tente novamente em um minuto.';
    return error.problem.detail ?? 'E-mail ou senha inválidos.';
  }
  return problemMessage(error);
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values);
      // Return the user where they were headed, but only within their own section.
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      const home = homePathFor(user.role);
      navigate(from?.startsWith(home) ? from : home, { replace: true });
    } catch (error) {
      setFormError(loginErrorMessage(error));
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="text-sm text-text-muted">Acesse sua conta para ver seus treinos.</p>
      </div>

      {formError ? <Alert variant="error">{formError}</Alert> : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="E-mail" error={errors.email?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="voce@exemplo.com"
            />
          )}
        </Field>

        <Field label="Senha" error={errors.password?.message}>
          {(field) => (
            <div className="flex gap-2">
              <Input
                {...field}
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
              />
              <Button
                variant="secondary"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
          )}
        </Field>

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          Entrar
        </Button>
      </form>

      <p className="text-xs text-text-subtle">
        Ainda não tem conta? Peça um convite ao seu personal trainer.
      </p>
    </div>
  );
}
