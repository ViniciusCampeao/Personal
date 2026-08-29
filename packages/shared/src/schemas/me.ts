import { z } from 'zod';
import { type AuthenticatedUserDto } from './auth';

export const sexes = ['MALE', 'FEMALE'] as const;
export const sexSchema = z.enum(sexes);

export const experienceLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export const experienceLevelSchema = z.enum(experienceLevels);

/**
 * Body of `PATCH /me/profile`. The e-mail is deliberately absent: it is the login
 * identity, and changing it safely needs a verification round-trip the product doesn't
 * have yet. `privateNotes` is absent too — those are the trainer's notes *about* the
 * student, never editable by the student.
 */
export const updateMyProfileSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto.').max(120).optional(),
  phone: z.string().trim().min(8, 'Telefone inválido.').max(20).nullish(),
  birthDate: z.coerce.date().nullish(),
  sex: sexSchema.nullish(),
  heightCm: z.number().min(80, 'Altura inválida.').max(260, 'Altura inválida.').nullish(),
  goal: z.string().trim().max(500).nullish(),
  experienceLevel: experienceLevelSchema.optional(),
  weeklyAvailability: z.number().int().min(1).max(14).nullish(),
});
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

export interface MyStudentProfileDto {
  trainerId: string;
  trainerName: string;
  birthDate: string | null;
  sex: (typeof sexes)[number] | null;
  heightCm: number | null;
  goal: string | null;
  experienceLevel: (typeof experienceLevels)[number];
  weeklyAvailability: number | null;
  startedAt: string;
}

export interface MyConsentDto {
  type: string;
  version: string;
  acceptedAt: string;
  revokedAt: string | null;
}

export interface MyProfileDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: AuthenticatedUserDto['role'];
  avatarUrl: string | null;
  createdAt: string;
  student: MyStudentProfileDto | null;
  consents: MyConsentDto[];
}

/**
 * Body of `DELETE /me` (LGPD art. 18, spec §10.5). The password is re-checked because
 * this is irreversible, and the typed word makes an accidental tap impossible.
 */
export const deleteMyAccountSchema = z.object({
  password: z.string().min(1, 'Informe sua senha.'),
  confirmation: z.literal('EXCLUIR', {
    message: 'Digite EXCLUIR para confirmar.',
  }),
});
export type DeleteMyAccountInput = z.infer<typeof deleteMyAccountSchema>;

/**
 * `GET /me/export` (LGPD art. 18 V, spec §10.4). Deliberately loose: it is a portability
 * dump meant to be machine-readable and complete, not a typed API contract that screens
 * render.
 */
export interface DataExportDto {
  exportedAt: string;
  format: 'json';
  user: Record<string, unknown>;
  studentProfile: Record<string, unknown> | null;
  consents: Record<string, unknown>[];
  anamneses: Record<string, unknown>[];
  assessments: Record<string, unknown>[];
  checkIns: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  personalRecords: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
}

export const legalDocumentTypes = ['terms', 'privacy'] as const;

/** `GET /legal/:type` — the versioned text a consent record points at (spec §10.8). */
export interface LegalDocumentDto {
  type: (typeof legalDocumentTypes)[number];
  version: string;
  title: string;
  updatedAt: string;
  /** Markdown. */
  body: string;
}
