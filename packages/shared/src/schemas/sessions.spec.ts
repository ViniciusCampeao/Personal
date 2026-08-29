import {
  finishSessionSchema,
  listSessionsQuerySchema,
  logSetSchema,
  startSessionSchema,
  substituteExerciseSchema,
  syncSessionsSchema,
} from './sessions';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('startSessionSchema', () => {
  it('accepts a well-formed start', () => {
    expect(
      startSessionSchema.safeParse({ clientUuid: uuid, workoutDayId: uuid, startedAt: new Date() })
        .success,
    ).toBe(true);
  });

  it('rejects a missing clientUuid', () => {
    expect(
      startSessionSchema.safeParse({ workoutDayId: uuid, startedAt: new Date() }).success,
    ).toBe(false);
  });
});

describe('logSetSchema', () => {
  const base = { clientUuid: uuid, sessionExerciseId: uuid, setNumber: 1, doneAt: new Date() };

  it('applies setType/toFailure defaults', () => {
    const result = logSetSchema.parse(base);
    expect(result.setType).toBe('WORK');
    expect(result.toFailure).toBe(false);
  });

  it('rejects a negative rir', () => {
    expect(logSetSchema.safeParse({ ...base, rir: -1 }).success).toBe(false);
  });
});

describe('substituteExerciseSchema', () => {
  it('accepts a substitution with a reason', () => {
    expect(
      substituteExerciseSchema.safeParse({ exerciseId: uuid, reason: 'dor no ombro' }).success,
    ).toBe(true);
  });

  it('rejects a non-uuid exerciseId', () => {
    expect(substituteExerciseSchema.safeParse({ exerciseId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('finishSessionSchema', () => {
  it('accepts a well-formed finish', () => {
    expect(
      finishSessionSchema.safeParse({ finishedAt: new Date(), perceivedEffort: 8, mood: 4 })
        .success,
    ).toBe(true);
  });

  it('rejects perceivedEffort out of range', () => {
    expect(
      finishSessionSchema.safeParse({ finishedAt: new Date(), perceivedEffort: 11 }).success,
    ).toBe(false);
  });
});

describe('listSessionsQuerySchema', () => {
  it('applies the pagination default', () => {
    expect(listSessionsQuerySchema.parse({}).limit).toBe(20);
  });
});

describe('syncSessionsSchema', () => {
  it('accepts a full batch: start, log_set, substitute, finish', () => {
    const result = syncSessionsSchema.safeParse({
      items: [
        { type: 'START', payload: { clientUuid: uuid, workoutDayId: uuid, startedAt: new Date() } },
        {
          type: 'LOG_SET',
          sessionClientUuid: uuid,
          prescribedExerciseId: uuid,
          payload: { clientUuid: uuid, setNumber: 1, doneAt: new Date() },
        },
        {
          type: 'SUBSTITUTE',
          sessionClientUuid: uuid,
          prescribedExerciseId: uuid,
          payload: { exerciseId: uuid },
        },
        {
          type: 'FINISH',
          sessionClientUuid: uuid,
          payload: { finishedAt: new Date() },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown item type', () => {
    expect(
      syncSessionsSchema.safeParse({ items: [{ type: 'DELETE_EVERYTHING', payload: {} }] }).success,
    ).toBe(false);
  });

  it('rejects an empty batch', () => {
    expect(syncSessionsSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('rejects a batch over the 200-item cap', () => {
    const items = Array.from({ length: 201 }, () => ({
      type: 'START' as const,
      payload: { clientUuid: uuid, workoutDayId: uuid, startedAt: new Date() },
    }));
    expect(syncSessionsSchema.safeParse({ items }).success).toBe(false);
  });
});
