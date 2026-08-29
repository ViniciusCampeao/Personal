import { z } from 'zod';

/**
 * Mirrors the Prisma enums in `schema.prisma` (same convention as `exercises.ts`).
 */
export const skinfoldProtocols = ['NONE', 'POLLOCK_3', 'POLLOCK_7', 'GUEDES', 'FAULKNER'] as const;
export const skinfoldProtocolSchema = z.enum(skinfoldProtocols);

export const skinfoldSites = [
  'TRICEPS',
  'SUBSCAPULAR',
  'CHEST',
  'MIDAXILLARY',
  'SUPRAILIAC',
  'ABDOMINAL',
  'THIGH',
] as const;
export const skinfoldSiteSchema = z.enum(skinfoldSites);

export const photoPoses = ['FRONT', 'BACK', 'SIDE_LEFT', 'SIDE_RIGHT'] as const;
export const photoPoseSchema = z.enum(photoPoses);

/** Spec §10.1: a specific, separate acceptance from Terms — recorded only once needed. */
const consentAcknowledgementSchema = z.object({ accepted: z.boolean() });

/**
 * `parq`/`injuries` are deliberately unstructured beyond this shape — the spec doesn't
 * pin down the exact PAR-Q question set, so the question text/codes stay a frontend
 * concern; the backend just stores whatever question-code -> yes/no map it's given.
 */
const parqAnswersSchema = z.record(z.string().min(1), z.boolean());
const injurySchema = z.object({
  description: z.string().trim().min(1).max(300),
  region: z.string().trim().max(100).optional(),
  sinceWhen: z.string().trim().max(100).optional(),
});

/** Body of `POST /students/:id/anamnesis` — always creates a new version (spec §5). */
export const createAnamnesisSchema = z.object({
  parq: parqAnswersSchema,
  injuries: z.array(injurySchema).default([]),
  conditions: z.string().trim().max(2000).optional(),
  medications: z.string().trim().max(2000).optional(),
  surgeries: z.string().trim().max(2000).optional(),
  smokes: z.boolean().default(false),
  alcohol: z.string().trim().max(200).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  trainingHistory: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  healthDataConsent: consentAcknowledgementSchema,
});
export type CreateAnamnesisInput = z.infer<typeof createAnamnesisSchema>;

/** Body of `POST /students/:id/medical-clearance` — `fileKey` from a prior presign. */
export const createMedicalClearanceSchema = z.object({
  fileKey: z.string().trim().min(1).max(500),
  issuedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
});
export type CreateMedicalClearanceInput = z.infer<typeof createMedicalClearanceSchema>;

/** Body of `POST /students/:id/assessments` — %BF/lean/fat mass/BMI computed server-side. */
export const createAssessmentSchema = z.object({
  assessedAt: z.coerce.date(),
  protocol: skinfoldProtocolSchema.default('NONE'),
  weightKg: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  restingHr: z.number().int().positive().optional(),
  bloodPressure: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
  skinfoldsMm: z.partialRecord(skinfoldSiteSchema, z.number().positive()).optional(),
  /** Site is free-form on purpose — `AssessmentMeasurement.site` is a plain string. */
  measurementsCm: z.record(z.string().trim().min(1).max(40), z.number().positive()).optional(),
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

/** Body of `POST /assessments/:id/photos` — `fileKey` from a prior presign. */
export const addAssessmentPhotoSchema = z.object({
  pose: photoPoseSchema,
  fileKey: z.string().trim().min(1).max(500),
  photoConsent: consentAcknowledgementSchema,
});
export type AddAssessmentPhotoInput = z.infer<typeof addAssessmentPhotoSchema>;

export const listAssessmentsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAssessmentsQuery = z.infer<typeof listAssessmentsQuerySchema>;

export const compareAssessmentsQuerySchema = z.object({
  a: z.string().uuid(),
  b: z.string().uuid(),
});
export type CompareAssessmentsQuery = z.infer<typeof compareAssessmentsQuerySchema>;

export interface AnamnesisDto {
  id: string;
  version: number;
  parq: Record<string, boolean>;
  injuries: Array<{ description: string; region: string | null; sinceWhen: string | null }>;
  conditions: string | null;
  medications: string | null;
  surgeries: string | null;
  smokes: boolean;
  alcohol: string | null;
  sleepHours: number | null;
  trainingHistory: string | null;
  notes: string | null;
  answeredAt: string;
}

export interface MedicalClearanceSummaryDto {
  id: string;
  fileUrl: string;
  issuedAt: string | null;
  expiresAt: string | null;
  verifiedAt: string | null;
}

export interface AnamnesisListResponseDto {
  versions: AnamnesisDto[];
  medicalClearance: MedicalClearanceSummaryDto | null;
}

export interface AssessmentMeasurementDto {
  site: string;
  valueCm: number;
}

export interface AssessmentSkinfoldDto {
  site: (typeof skinfoldSites)[number];
  valueMm: number;
}

export interface AssessmentPhotoDto {
  id: string;
  pose: (typeof photoPoses)[number];
  url: string;
  takenAt: string;
}

export interface AssessmentSummaryDto {
  id: string;
  assessedAt: string;
  protocol: (typeof skinfoldProtocols)[number];
  weightKg: number | null;
  bodyFatPct: number | null;
  bmi: number | null;
}

export interface AssessmentDetailDto extends AssessmentSummaryDto {
  heightCm: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  restingHr: number | null;
  bloodPressure: string | null;
  notes: string | null;
  measurements: AssessmentMeasurementDto[];
  skinfolds: AssessmentSkinfoldDto[];
  photos: AssessmentPhotoDto[];
}

export interface ListAssessmentsResponseDto {
  items: AssessmentSummaryDto[];
  nextCursor: string | null;
}

export interface AssessmentCompareDiffDto {
  weightKg: number | null;
  bodyFatPct: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  bmi: number | null;
  measurements: Array<{ site: string; deltaCm: number }>;
}

export interface AssessmentCompareDto {
  a: AssessmentDetailDto;
  b: AssessmentDetailDto;
  diff: AssessmentCompareDiffDto;
}
