import { createExerciseSchema, listExercisesQuerySchema, updateExerciseSchema } from './exercises';

describe('createExerciseSchema', () => {
  const base = {
    name: 'Supino reto',
    movementPattern: 'HORIZONTAL_PUSH' as const,
    equipment: 'BARBELL' as const,
    muscles: [{ muscle: 'CHEST' as const, role: 'PRIMARY' as const }],
  };

  it('accepts a well-formed custom exercise and defaults loadType/unilateral/arrays', () => {
    const result = createExerciseSchema.parse(base);
    expect(result.loadType).toBe('EXTERNAL');
    expect(result.unilateral).toBe(false);
    expect(result.cues).toEqual([]);
  });

  it('rejects an exercise with no muscles', () => {
    expect(createExerciseSchema.safeParse({ ...base, muscles: [] }).success).toBe(false);
  });

  it('rejects an invalid enum value', () => {
    expect(createExerciseSchema.safeParse({ ...base, equipment: 'NOT_REAL' }).success).toBe(false);
  });
});

describe('updateExerciseSchema', () => {
  it('accepts a partial patch with a single field', () => {
    expect(updateExerciseSchema.safeParse({ unilateral: true }).success).toBe(true);
  });
});

describe('listExercisesQuerySchema', () => {
  it('applies scope/limit defaults', () => {
    const result = listExercisesQuerySchema.parse({});
    expect(result.scope).toBe('all');
    expect(result.limit).toBe(20);
  });

  it('coerces limit from the query-string it actually receives', () => {
    expect(listExercisesQuerySchema.parse({ limit: '50' }).limit).toBe(50);
  });

  it('rejects a limit above the cap', () => {
    expect(listExercisesQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
  });
});
