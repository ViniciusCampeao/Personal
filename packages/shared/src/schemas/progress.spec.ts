import { adherenceQuerySchema, progressVolumeQuerySchema } from './progress';

describe('progressVolumeQuerySchema', () => {
  it('applies the weeks default', () => {
    expect(progressVolumeQuerySchema.parse({}).weeks).toBe(12);
  });

  it('accepts a muscle filter', () => {
    const result = progressVolumeQuerySchema.parse({ muscle: 'CHEST', weeks: '4' });
    expect(result.muscle).toBe('CHEST');
    expect(result.weeks).toBe(4);
  });

  it('rejects an invalid muscle', () => {
    expect(progressVolumeQuerySchema.safeParse({ muscle: 'NOT_A_MUSCLE' }).success).toBe(false);
  });

  it('rejects weeks above the cap', () => {
    expect(progressVolumeQuerySchema.safeParse({ weeks: '53' }).success).toBe(false);
  });
});

describe('adherenceQuerySchema', () => {
  it('applies the weeks default', () => {
    expect(adherenceQuerySchema.parse({}).weeks).toBe(12);
  });
});
