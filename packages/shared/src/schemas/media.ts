import { z } from 'zod';

/**
 * `POST /media/presign` (spec §5) is a generic upload-intent endpoint reused across
 * milestones. Each `kind` carries its own allowed MIME types and size cap.
 */
export const presignKinds = [
  'exercise-video',
  'assessment-photo',
  'medical-clearance',
  'tenant-logo',
] as const;

const videoMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
const photoMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const clearanceMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'] as const;
const logoMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] as const;

export const MAX_EXERCISE_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_ASSESSMENT_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_MEDICAL_CLEARANCE_BYTES = 10 * 1024 * 1024;
export const MAX_TENANT_LOGO_BYTES = 5 * 1024 * 1024;

const PRESIGN_RULES: Record<
  (typeof presignKinds)[number],
  { mimes: readonly string[]; maxBytes: number }
> = {
  'exercise-video': { mimes: videoMimeTypes, maxBytes: MAX_EXERCISE_VIDEO_BYTES },
  'assessment-photo': { mimes: photoMimeTypes, maxBytes: MAX_ASSESSMENT_PHOTO_BYTES },
  'medical-clearance': { mimes: clearanceMimeTypes, maxBytes: MAX_MEDICAL_CLEARANCE_BYTES },
  'tenant-logo': { mimes: logoMimeTypes, maxBytes: MAX_TENANT_LOGO_BYTES },
};

export const presignRequestSchema = z
  .object({
    kind: z.enum(presignKinds),
    mime: z.string(),
    sizeBytes: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    const rule = PRESIGN_RULES[value.kind];
    if (!rule.mimes.includes(value.mime)) {
      ctx.addIssue({
        code: 'custom',
        path: ['mime'],
        message: 'Formato não suportado para esse tipo de upload.',
      });
    }
    if (value.sizeBytes > rule.maxBytes) {
      ctx.addIssue({
        code: 'custom',
        path: ['sizeBytes'],
        message: 'Arquivo maior que o limite permitido.',
      });
    }
  });
export type PresignRequestInput = z.infer<typeof presignRequestSchema>;

export interface PresignResponseDto {
  uploadUrl: string;
  key: string;
}
