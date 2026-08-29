import { listCheckInsQuerySchema, submitCheckInSchema } from './checkins';

describe('submitCheckInSchema', () => {
  it('accepts an empty body — every field is optional', () => {
    expect(submitCheckInSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a fully-filled check-in', () => {
    expect(
      submitCheckInSchema.safeParse({
        sleepQuality: 4,
        energy: 3,
        soreness: 2,
        stress: 5,
        weightKg: 78.5,
        notes: 'Semana puxada de trabalho.',
      }).success,
    ).toBe(true);
  });

  it('rejects a slider value above 5', () => {
    expect(submitCheckInSchema.safeParse({ stress: 6 }).success).toBe(false);
  });

  it('rejects a negative weight', () => {
    expect(submitCheckInSchema.safeParse({ weightKg: -1 }).success).toBe(false);
  });

  it('does not accept a client-supplied weekStart', () => {
    const result = submitCheckInSchema.parse({ weekStart: '2026-01-01' } as never);
    expect(result).not.toHaveProperty('weekStart');
  });
});

describe('listCheckInsQuerySchema', () => {
  it('applies the default limit', () => {
    expect(listCheckInsQuerySchema.parse({}).limit).toBe(20);
  });
});
