import { z } from 'zod';

/**
 * A trainer invites a student by e-mail or phone (spec §5 "POST /invites"). At least
 * one contact channel is required — the accept screen still asks for e-mail explicitly
 * if only a phone number was supplied, since login is always by e-mail.
 */
export const createInviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('E-mail inválido.').optional(),
    phone: z.string().trim().min(8, 'Telefone inválido.').max(20).optional(),
    expiresInDays: z.number().int().min(1).max(30).default(7),
  })
  .refine((value) => Boolean(value.email ?? value.phone), {
    message: 'Informe e-mail ou telefone do aluno.',
    path: ['email'],
  });
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export interface InvitePreviewDto {
  trainerName: string;
  tenantName: string;
  email: string | null;
  phone: string | null;
  expiresAt: string;
}

export interface CreateInviteResponseDto {
  id: string;
  token: string;
  url: string;
  qrCodeDataUrl: string;
  expiresAt: string;
}

/**
 * Onboarding form the invited student fills in. `terms` and `privacy` must be
 * explicitly and separately accepted (LGPD §10.1) — health-data consent is asked for
 * later, when the anamnesis is actually collected (M6), not at bare signup.
 */
export const acceptInviteSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto.').max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido.').optional(),
  phone: z.string().trim().min(8, 'Telefone inválido.').max(20).optional(),
  password: z
    .string()
    .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
    .max(72, 'Senha muito longa.'),
  consents: z.object({
    terms: z.literal(true, { message: 'É necessário aceitar os Termos de Uso.' }),
    privacy: z.literal(true, { message: 'É necessário aceitar a Política de Privacidade.' }),
  }),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
