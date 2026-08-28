import { presignRequestSchema } from './media';

describe('presignRequestSchema', () => {
  const base = { kind: 'exercise-video' as const, mime: 'video/mp4' as const, sizeBytes: 1024 };

  it('accepts a well-formed presign request', () => {
    expect(presignRequestSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an unsupported mime type', () => {
    expect(presignRequestSchema.safeParse({ ...base, mime: 'application/pdf' }).success).toBe(
      false,
    );
  });

  it('rejects a file over the size limit', () => {
    expect(presignRequestSchema.safeParse({ ...base, sizeBytes: 300 * 1024 * 1024 }).success).toBe(
      false,
    );
  });

  it('rejects an unknown kind', () => {
    expect(presignRequestSchema.safeParse({ ...base, kind: 'assessment-photo' }).success).toBe(
      false,
    );
  });
});
