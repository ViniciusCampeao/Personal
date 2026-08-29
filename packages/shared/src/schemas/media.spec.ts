import { presignRequestSchema } from './media';

describe('presignRequestSchema', () => {
  const base = { kind: 'exercise-video' as const, mime: 'video/mp4', sizeBytes: 1024 };

  it('accepts a well-formed presign request', () => {
    expect(presignRequestSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an unsupported mime type for the given kind', () => {
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
    expect(presignRequestSchema.safeParse({ ...base, kind: 'not-a-real-kind' }).success).toBe(
      false,
    );
  });

  it('accepts an assessment photo', () => {
    const result = presignRequestSchema.safeParse({
      kind: 'assessment-photo',
      mime: 'image/jpeg',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a video mime for an assessment photo', () => {
    const result = presignRequestSchema.safeParse({
      kind: 'assessment-photo',
      mime: 'video/mp4',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a medical clearance PDF', () => {
    const result = presignRequestSchema.safeParse({
      kind: 'medical-clearance',
      mime: 'application/pdf',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(true);
  });
});
