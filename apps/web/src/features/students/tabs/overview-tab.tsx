import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudentDetailDto, UpdateStudentInput } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, formatLength } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { updateStudent } from '../students-api';
import { useStudent } from './use-student';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'PAUSED', label: 'Pausado' },
  { value: 'ARCHIVED', label: 'Arquivado' },
] as const;

const EXPERIENCE_OPTIONS = [
  { value: 'BEGINNER', label: 'Iniciante' },
  { value: 'INTERMEDIATE', label: 'Intermediário' },
  { value: 'ADVANCED', label: 'Avançado' },
] as const;

export function StudentOverviewTab() {
  const student = useStudent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [goal, setGoal] = useState(student.goal ?? '');
  const [privateNotes, setNotes] = useState(student.privateNotes ?? '');
  const [status, setStatus] = useState<StudentDetailDto['status']>(student.status);
  const [experienceLevel, setExperience] = useState(student.experienceLevel);
  const [weeklyAvailability, setAvailability] = useState(
    student.weeklyAvailability != null ? String(student.weeklyAvailability) : '',
  );

  const save = useMutation({
    mutationFn: (input: UpdateStudentInput) => updateStudent(student.id, input),
    meta: { silent: true },
    onSuccess: async (saved) => {
      queryClient.setQueryData(['students', student.id, 'detail'], saved);
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      toast('Aluno atualizado.', 'success');
    },
  });

  const availability = Number(weeklyAvailability);

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start">
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Acompanhamento</h2>

        <Field label="Objetivo">
          {(field) => <Input {...field} value={goal} onChange={(e) => setGoal(e.target.value)} />}
        </Field>

        <Field label="Situação">
          {(field) => (
            <select
              {...field}
              value={status}
              onChange={(e) => setStatus(e.target.value as StudentDetailDto['status'])}
              className="min-h-touch rounded-field border border-border bg-surface-sunken px-3 text-base text-text"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              {student.status === 'PENDING' ? (
                <option value="PENDING">Convite pendente</option>
              ) : null}
            </select>
          )}
        </Field>

        <Field label="Experiência">
          {(field) => (
            <select
              {...field}
              value={experienceLevel}
              onChange={(e) => setExperience(e.target.value as typeof experienceLevel)}
              className="min-h-touch rounded-field border border-border bg-surface-sunken px-3 text-base text-text"
            >
              {EXPERIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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

        <Field label="Notas privadas" hint="Visível só para você — o aluno nunca vê este campo.">
          {(field) => (
            <textarea
              {...field}
              value={privateNotes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="rounded-field border border-border bg-surface-sunken p-3 text-base text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            />
          )}
        </Field>

        {save.isError ? <Alert variant="error">{problemMessage(save.error)}</Alert> : null}

        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              goal: goal.trim() || null,
              privateNotes: privateNotes.trim() || null,
              status,
              experienceLevel,
              weeklyAvailability:
                weeklyAvailability.trim() !== '' && Number.isFinite(availability)
                  ? availability
                  : null,
            })
          }
          className="self-start"
        >
          Salvar
        </Button>
      </section>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <CardTitle>Dados do aluno</CardTitle>
          <dl className="flex flex-col gap-2 text-sm">
            <Row
              label="Nascimento"
              value={student.birthDate ? formatDate(student.birthDate) : '—'}
            />
            <Row
              label="Sexo"
              value={
                student.sex === 'FEMALE' ? 'Feminino' : student.sex === 'MALE' ? 'Masculino' : '—'
              }
            />
            <Row
              label="Altura"
              value={student.heightCm != null ? formatLength(student.heightCm) : '—'}
            />
            <Row
              label="Última avaliação"
              value={student.lastAssessmentAt ? formatDate(student.lastAssessmentAt) : 'Nenhuma'}
            />
            <Row label="Treinos concluídos" value={String(student.totalSessions)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
