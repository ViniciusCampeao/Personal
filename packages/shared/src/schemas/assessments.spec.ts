import {
  addAssessmentPhotoSchema,
  createAnamnesisSchema,
  createAssessmentSchema,
  createMedicalClearanceSchema,
  listAssessmentsQuerySchema,
} from './assessments';

describe('createAnamnesisSchema', () => {
  const base = {
    parq: { q1: true, q2: false },
    healthDataConsent: { accepted: true },
  };

  it('accepts a minimal well-formed anamnesis', () => {
    expect(createAnamnesisSchema.safeParse(base).success).toBe(true);
  });

  it('defaults injuries to an empty array and smokes to false', () => {
    const result = createAnamnesisSchema.parse(base);
    expect(result.injuries).toEqual([]);
    expect(result.smokes).toBe(false);
  });

  it('accepts a list of injuries', () => {
    const result = createAnamnesisSchema.safeParse({
      ...base,
      injuries: [{ description: 'lesão no ombro', region: 'ombro direito' }],
    });
    expect(result.success).toBe(true);
  });

  it('requires healthDataConsent', () => {
    expect(createAnamnesisSchema.safeParse({ parq: {} }).success).toBe(false);
  });
});

describe('createMedicalClearanceSchema', () => {
  it('accepts just a fileKey', () => {
    expect(
      createMedicalClearanceSchema.safeParse({ fileKey: 'medical-clearances/x.pdf' }).success,
    ).toBe(true);
  });
});

describe('createAssessmentSchema', () => {
  it('accepts a full GUEDES assessment', () => {
    const result = createAssessmentSchema.safeParse({
      assessedAt: new Date(),
      protocol: 'GUEDES',
      weightKg: 80,
      heightCm: 178,
      skinfoldsMm: { TRICEPS: 12, SUPRAILIAC: 14, ABDOMINAL: 20 },
      measurementsCm: { WAIST: 85 },
    });
    expect(result.success).toBe(true);
  });

  it('defaults protocol to NONE', () => {
    expect(createAssessmentSchema.parse({ assessedAt: new Date() }).protocol).toBe('NONE');
  });

  it('rejects an unknown skinfold site key', () => {
    const result = createAssessmentSchema.safeParse({
      assessedAt: new Date(),
      skinfoldsMm: { NOT_A_SITE: 10 },
    });
    expect(result.success).toBe(false);
  });
});

describe('addAssessmentPhotoSchema', () => {
  it('requires photoConsent', () => {
    expect(
      addAssessmentPhotoSchema.safeParse({ pose: 'FRONT', fileKey: 'assessment-photos/x.jpg' })
        .success,
    ).toBe(false);
  });

  it('accepts a well-formed photo', () => {
    const result = addAssessmentPhotoSchema.safeParse({
      pose: 'FRONT',
      fileKey: 'assessment-photos/x.jpg',
      photoConsent: { accepted: true },
    });
    expect(result.success).toBe(true);
  });
});

describe('listAssessmentsQuerySchema', () => {
  it('applies the pagination default', () => {
    expect(listAssessmentsQuerySchema.parse({}).limit).toBe(20);
  });
});
