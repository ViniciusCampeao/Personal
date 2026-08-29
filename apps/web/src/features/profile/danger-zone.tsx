import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { useAuth } from '@/features/auth/auth-context';
import { deleteMyAccount } from './me-api';

/**
 * LGPD art. 18, VI (spec §10.5). Two gates on purpose: the password proves it is the
 * account owner, and the typed word makes an accidental tap impossible. There is no
 * undo — the API cascades the deletion.
 */
export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const { logout } = useAuth();
  const navigate = useNavigate();

  const remove = useMutation({
    mutationFn: () => deleteMyAccount({ password, confirmation: 'EXCLUIR' }),
    meta: { silent: true },
    onSuccess: async () => {
      await logout();
      navigate(PATHS.login, { replace: true });
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-card border border-danger/40 bg-danger/5 p-4">
      <h2 className="text-base font-semibold text-danger">Excluir minha conta</h2>
      <p className="text-sm text-text-muted">
        Apaga seu cadastro, seu histórico de treinos, suas avaliações e seus dados de saúde. A ação
        é permanente. Baixe seus dados antes, se quiser guardá-los.
      </p>

      {!open ? (
        <Button variant="secondary" onClick={() => setOpen(true)} className="self-start">
          Quero excluir minha conta
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label="Sua senha">
            {(field) => (
              <Input
                {...field}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>

          <Field label="Digite EXCLUIR para confirmar">
            {(field) => (
              <Input
                {...field}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoCapitalize="characters"
              />
            )}
          </Field>

          {remove.isError ? <Alert variant="error">{problemMessage(remove.error)}</Alert> : null}

          <div className="flex flex-col gap-2">
            <Button
              variant="danger"
              loading={remove.isPending}
              disabled={confirmation !== 'EXCLUIR' || password === ''}
              onClick={() => remove.mutate()}
            >
              Excluir definitivamente
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
