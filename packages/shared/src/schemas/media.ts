import { z } from 'zod';

/**
 * `POST /media/presign` (spec §5) is a generic upload-intent endpoint reused across
 * milestones — only `exercise-video` (M2) is accepted today. M6 adds assessment-photo
 * kinds without changing this shape.
 */
export const presignKinds = ['exercise-video'] as const;

const videoMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

export const MAX_EXERCISE_VIDEO_BYTES = 200 * 1024 * 1024;

export const presignRequestSchema = z.object({
  kind: z.enum(presignKinds),
  mime: z.enum(videoMimeTypes, { message: 'Formato de vídeo não suportado.' }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_EXERCISE_VIDEO_BYTES, 'Arquivo maior que o limite permitido.'),
});
export type PresignRequestInput = z.infer<typeof presignRequestSchema>;

export interface PresignResponseDto {
  uploadUrl: string;
  key: string;
}
