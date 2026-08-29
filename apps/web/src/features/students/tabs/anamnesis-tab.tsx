import { useQuery } from '@tanstack/react-query';
import type { AnamnesisListResponseDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { useStudent } from './use-student';

/**
 * Sensitive data (spec §10.3/§10.6): the API decrypts it per request and records an
 * audit entry because the reader here is never the data subject.
 */
export function StudentAnamnesisTab() {
  const student = useStudent();
  const query = useQuery({
    queryKey: ['students', student.id, 'anamnesis'],
    queryFn: () => apiFetch<AnamnesisListResponseDto>(`/students/${student.id}/anamnesis`),
  });

  if (query.isPending) return <Skeleton className="h-48" />;
  if (query.isError) return <Alert variant="error">{problemMessage(query.error)}</Alert>;

  const { versions, medicalClearance } = query.data;
  const current = versions[0];

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="warning">
        Dados de saúde. Todo acesso seu fica registrado em log de auditoria (LGPD).
      </Alert>

      {medicalClearance ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <CardTitle>Atestado médico</CardTitle>
            <CardDescription>
              {medicalClearance.issuedAt
                ? `Emitido em ${formatDate(medicalClearance.issuedAt)}`
                : 'Sem data de emissão'}
              {medicalClearance.expiresAt
                ? ` · válido até ${formatDate(medicalClearance.expiresAt)}`
                : ''}
            </CardDescription>
            <a
              href={medicalClearance.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent underline"
            >
              Abrir arquivo
            </a>
          </CardContent>
        </Card>
      ) : null}

      {!current ? (
        <Card>
          <CardContent>
            <CardDescription>Este aluno ainda não respondeu a anamnese.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Versão {current.version}</CardTitle>
              <span className="text-xs text-text-subtle">
                respondida em {formatDate(current.answeredAt)}
              </span>
            </div>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">PAR-Q</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {Object.entries(current.parq).map(([question, answer]) => (
                  <li key={question} className="flex justify-between gap-3">
                    <span className="text-text-muted">{question}</span>
                    <span className={answer ? 'font-medium text-warning' : 'text-text-muted'}>
                      {answer ? 'Sim' : 'Não'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {current.injuries.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Lesões</h3>
                <ul className="flex flex-col gap-1 text-sm text-text-muted">
                  {current.injuries.map((injury, index) => (
                    <li key={index}>
                      {injury.description}
                      {injury.region ? ` — ${injury.region}` : ''}
                      {injury.sinceWhen ? ` (${injury.sinceWhen})` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Condições" value={current.conditions} />
              <Row label="Medicamentos" value={current.medications} />
              <Row label="Cirurgias" value={current.surgeries} />
              <Row label="Fumante" value={current.smokes ? 'Sim' : 'Não'} />
              <Row label="Álcool" value={current.alcohol} />
              <Row
                label="Horas de sono"
                value={current.sleepHours != null ? String(current.sleepHours) : null}
              />
              <Row label="Histórico de treino" value={current.trainingHistory} />
              <Row label="Observações" value={current.notes} />
            </dl>
          </CardContent>
        </Card>
      )}

      {versions.length > 1 ? (
        <p className="text-sm text-text-subtle">
          {versions.length} versões registradas — a anamnese nunca é sobrescrita.
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-text-subtle">{label}</dt>
      <dd className="text-text-muted">{value}</dd>
    </div>
  );
}
