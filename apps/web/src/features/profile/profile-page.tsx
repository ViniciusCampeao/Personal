import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MyProfileDto, UpdateMyProfileInput } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { formatDate } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { useAuth } from '@/features/auth/auth-context';
import { useSyncStatus } from '@/features/sync/use-sync';
import { TenantBrandingCard } from '@/features/tenant/tenant-branding-card';
import { DangerZone } from './danger-zone';
import { exportMyData, fetchMyProfile, updateMyProfile } from './me-api';

const EXPERIENCE_LABELS = {
  BEGINNER: 'Iniciante',
  INTERMEDIATE: 'Intermediário',
  ADVANCED: 'Avançado',
} as const;

const CONSENT_LABELS: Record<string, string> = {
  TERMS: 'Termos de Uso',
  PRIVACY: 'Política de Privacidade',
  HEALTH_DATA: 'Tratamento de dados de saúde',
  PHOTO: 'Uso de fotos',
};

export function ProfilePage() {
  const query = useQuery({ queryKey: ['me', 'profile'], queryFn: fetchMyProfile });

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) return <Alert variant="error">{problemMessage(query.error)}</Alert>;

  return <ProfileForm profile={query.data} />;
}

function ProfileForm({ profile }: { profile: MyProfileDto }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pending } = useSyncStatus();

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [birthDate, setBirthDate] = useState(profile.student?.birthDate?.slice(0, 10) ?? '');
  const [sex, setSex] = useState(profile.student?.sex ?? '');
  const [heightCm, setHeight] = useState(
    profile.student?.heightCm != null ? String(profile.student.heightCm) : '',
  );
  const [goal, setGoal] = useState(profile.student?.goal ?? '');
  const [experienceLevel, setExperience] = useState(profile.student?.experienceLevel ?? 'BEGINNER');
  const [weeklyAvailability, setAvailability] = useState(
    profile.student?.weeklyAvailability != null ? String(profile.student.weeklyAvailability) : '',
  );

  useEffect(() => {
    setName(profile.name);
  }, [profile.name]);

  const save = useMutation({
    mutationFn: (input: UpdateMyProfileInput) => updateMyProfile(input),
    meta: { silent: true },
    onSuccess: (saved) => {
      queryClient.setQueryData(['me', 'profile'], saved);
      toast('Perfil atualizado.', 'success');
    },
  });

  const exporting = useMutation({
    mutationFn: exportMyData,
    meta: { silent: true },
    onSuccess: (data) => {
      // Handed to the browser as a file: the LGPD right is to *receive* the data, not
      // to look at it on a screen.
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `meus-dados-${data.exportedAt.slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast('Download iniciado.', 'success');
    },
  });

  function handleSave() {
    const height = Number(heightCm.replace(',', '.'));
    const availability = Number(weeklyAvailability);
    save.mutate({
      name,
      phone: phone.trim() || null,
      ...(profile.student
        ? {
            birthDate: birthDate ? new Date(birthDate) : null,
            sex: (sex || null) as UpdateMyProfileInput['sex'],
            heightCm: heightCm.trim() !== '' && Number.isFinite(height) ? height : null,
            goal: goal.trim() || null,
            experienceLevel,
            weeklyAvailability:
              weeklyAvailability.trim() !== '' && Number.isFinite(availability)
                ? availability
                : null,
          }
        : {}),
    });
  }

  async function handleLogout() {
    await logout();
    navigate(PATHS.login, { replace: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Perfil</h1>

      <section className="flex flex-col gap-4">
        <Field label="Nome">
          {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>

        <Field label="E-mail" hint="Para trocar o e-mail, fale com seu treinador.">
          {(field) => <Input {...field} value={profile.email} readOnly />}
        </Field>

        <Field label="Telefone">
          {(field) => (
            <Input
              {...field}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
            />
          )}
        </Field>

        {profile.student ? (
          <>
            <Field label="Data de nascimento">
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              )}
            </Field>

            <Field label="Sexo">
              {(field) => (
                <select
                  {...field}
                  value={sex ?? ''}
                  onChange={(e) => setSex(e.target.value as typeof sex)}
                  className="min-h-touch rounded-lg border border-border bg-surface-sunken px-3 text-base text-text"
                >
                  <option value="">Não informado</option>
                  <option value="FEMALE">Feminino</option>
                  <option value="MALE">Masculino</option>
                </select>
              )}
            </Field>

            <Field label="Altura (cm)">
              {(field) => (
                <Input
                  {...field}
                  value={heightCm}
                  onChange={(e) => setHeight(e.target.value)}
                  inputMode="decimal"
                />
              )}
            </Field>

            <Field label="Objetivo">
              {(field) => (
                <Input {...field} value={goal} onChange={(e) => setGoal(e.target.value)} />
              )}
            </Field>

            <Field label="Experiência">
              {(field) => (
                <select
                  {...field}
                  value={experienceLevel}
                  onChange={(e) => setExperience(e.target.value as typeof experienceLevel)}
                  className="min-h-touch rounded-lg border border-border bg-surface-sunken px-3 text-base text-text"
                >
                  {Object.entries(EXPERIENCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Treinos por semana">
              {(field) => (
                <Input
                  {...field}
                  value={weeklyAvailability}
                  onChange={(e) => setAvailability(e.target.value)}
                  inputMode="numeric"
                />
              )}
            </Field>
          </>
        ) : null}

        {save.isError ? <Alert variant="error">{problemMessage(save.error)}</Alert> : null}

        <Button loading={save.isPending} onClick={handleSave}>
          Salvar
        </Button>
      </section>

      {profile.student ? (
        <Card>
          <CardContent className="flex flex-col gap-1">
            <CardTitle>Seu treinador</CardTitle>
            <CardDescription>
              {profile.student.trainerName} · desde {formatDate(profile.student.startedAt)}
            </CardDescription>
          </CardContent>
        </Card>
      ) : null}

      {profile.role === 'TRAINER' ? <TenantBrandingCard /> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Consentimentos</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {profile.consents.map((consent) => (
            <li
              key={`${consent.type}-${consent.acceptedAt}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3"
            >
              <span>{CONSENT_LABELS[consent.type] ?? consent.type}</span>
              <span className="text-xs text-text-subtle">
                {consent.revokedAt
                  ? `revogado em ${formatDate(consent.revokedAt)}`
                  : `aceito em ${formatDate(consent.acceptedAt)} (${consent.version})`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Seus dados</h2>
        <p className="text-sm text-text-muted">
          Você pode baixar tudo o que guardamos sobre você, em JSON.
        </p>
        <Button
          variant="secondary"
          loading={exporting.isPending}
          onClick={() => exporting.mutate()}
        >
          Exportar meus dados
        </Button>
        {exporting.isError ? (
          <Alert variant="error">{problemMessage(exporting.error)}</Alert>
        ) : null}
      </section>

      <Button variant="secondary" onClick={() => void handleLogout()}>
        Sair
      </Button>
      {pending > 0 ? (
        <p className="-mt-2 text-xs text-warning">
          {pending}{' '}
          {pending === 1 ? 'registro ainda não sincronizado' : 'registros ainda não sincronizados'}.
          Conecte-se antes de sair para não perder nada.
        </p>
      ) : null}

      {profile.role === 'STUDENT' ? <DangerZone /> : null}
    </div>
  );
}
