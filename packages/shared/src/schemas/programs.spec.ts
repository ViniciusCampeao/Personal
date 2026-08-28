import {
  createProgramSchema,
  listProgramsQuerySchema,
  replaceDayExercisesSchema,
  updateProgramSchema,
} from './programs';

describe('createProgramSchema', () => {
  it('accepts a program with a studentId', () => {
    expect(
      createProgramSchema.safeParse({
        studentId: '11111111-1111-4111-8111-111111111111',
        name: 'Hipertrofia 4x',
      }).success,
    ).toBe(true);
  });

  it('accepts a template with isTemplate: true and no studentId', () => {
    expect(createProgramSchema.safeParse({ isTemplate: true, name: 'Template ABC' }).success).toBe(
      true,
    );
  });

  it('rejects neither studentId nor isTemplate', () => {
    expect(createProgramSchema.safeParse({ name: 'Sem dono' }).success).toBe(false);
  });

  it('rejects both studentId and isTemplate at once', () => {
    expect(
      createProgramSchema.safeParse({
        studentId: '11111111-1111-4111-8111-111111111111',
        isTemplate: true,
        name: 'Ambíguo',
      }).success,
    ).toBe(false);
  });
});

describe('updateProgramSchema', () => {
  it('accepts a partial patch', () => {
    expect(updateProgramSchema.safeParse({ status: 'FINISHED' }).success).toBe(true);
  });

  it('rejects status: ACTIVE — that only happens through /activate', () => {
    expect(updateProgramSchema.safeParse({ status: 'ACTIVE' }).success).toBe(false);
  });
});

describe('listProgramsQuerySchema', () => {
  it('applies the pagination default', () => {
    expect(listProgramsQuerySchema.parse({}).limit).toBe(20);
  });

  it('coerces isTemplate from the query-string it actually receives', () => {
    expect(listProgramsQuerySchema.parse({ isTemplate: 'true' }).isTemplate).toBe(true);
  });
});

describe('replaceDayExercisesSchema', () => {
  const exerciseId = '11111111-1111-4111-8111-111111111111';

  it('accepts a bi-set sharing a groupKey', () => {
    const result = replaceDayExercisesSchema.safeParse([
      {
        exerciseId,
        orderIndex: 0,
        groupKey: 'biset-1',
        sets: [{ setNumber: 1 }],
      },
      {
        exerciseId,
        orderIndex: 1,
        groupKey: 'biset-1',
        sets: [{ setNumber: 1 }],
      },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects an exercise with no sets', () => {
    const result = replaceDayExercisesSchema.safeParse([{ exerciseId, orderIndex: 0, sets: [] }]);
    expect(result.success).toBe(false);
  });
});
