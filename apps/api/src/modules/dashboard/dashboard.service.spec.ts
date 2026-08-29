import { type TenantPrismaClient } from '../../common/prisma/tenant-prisma.provider';
import { type ProgressService } from '../progress/progress.service';
import { DashboardService } from './dashboard.service';

const DAY = 86_400_000;

interface Stubs {
  program?: unknown;
  setLogsByExercise?: Record<string, Array<{ estimated1rm: number | null }>>;
  checkIns?: Array<{ weekStart: Date; soreness: number | null; stress: number | null }>;
}

/** Only the handful of calls the two risk heuristics actually make. */
function serviceWith(stubs: Stubs): DashboardService {
  const db = {
    program: { findFirst: async () => stubs.program ?? null },
    setLog: {
      findMany: async (args: { where: { sessionExercise: { exerciseId: string } } }) =>
        stubs.setLogsByExercise?.[args.where.sessionExercise.exerciseId] ?? [],
    },
    checkIn: { findMany: async () => stubs.checkIns ?? [] },
  } as unknown as TenantPrismaClient;

  return new DashboardService(db, {} as ProgressService);
}

function programWith(exerciseIds: string[]) {
  return { days: [{ exercises: exerciseIds.map((exerciseId) => ({ exerciseId })) }] };
}

type Internals = {
  isE1rmStagnant(studentId: string): Promise<boolean>;
  isSorenessOrStressHigh(studentId: string): Promise<boolean>;
};

describe('DashboardService — e1RM stagnation', () => {
  it('does not fire without an active program', async () => {
    const service = serviceWith({}) as unknown as Internals;
    expect(await service.isE1rmStagnant('s1')).toBe(false);
  });

  it('does not fire when no exercise has enough data points', async () => {
    const service = serviceWith({
      program: programWith(['ex-a', 'ex-b']),
      setLogsByExercise: { 'ex-a': [{ estimated1rm: 100 }], 'ex-b': [] },
    }) as unknown as Internals;
    expect(await service.isE1rmStagnant('s1')).toBe(false);
  });

  it('fires when the latest e1RM is at or below the oldest in the window', async () => {
    const service = serviceWith({
      program: programWith(['ex-a']),
      setLogsByExercise: { 'ex-a': [{ estimated1rm: 120 }, { estimated1rm: 110 }] },
    }) as unknown as Internals;
    expect(await service.isE1rmStagnant('s1')).toBe(true);
  });

  it('treats a flat series as stagnant', async () => {
    const service = serviceWith({
      program: programWith(['ex-a']),
      setLogsByExercise: { 'ex-a': [{ estimated1rm: 100 }, { estimated1rm: 100 }] },
    }) as unknown as Internals;
    expect(await service.isE1rmStagnant('s1')).toBe(true);
  });

  it('does not fire when progressing', async () => {
    const service = serviceWith({
      program: programWith(['ex-a']),
      setLogsByExercise: { 'ex-a': [{ estimated1rm: 100 }, { estimated1rm: 130 }] },
    }) as unknown as Internals;
    expect(await service.isE1rmStagnant('s1')).toBe(false);
  });

  it('measures the 60% threshold against evaluable exercises only', async () => {
    // 3 evaluable, 2 stagnant (67% >= 60%); the 2 unevaluable ones are ignored.
    const service = serviceWith({
      program: programWith(['ex-a', 'ex-b', 'ex-c', 'ex-d', 'ex-e']),
      setLogsByExercise: {
        'ex-a': [{ estimated1rm: 120 }, { estimated1rm: 110 }],
        'ex-b': [{ estimated1rm: 100 }, { estimated1rm: 100 }],
        'ex-c': [{ estimated1rm: 100 }, { estimated1rm: 130 }],
        'ex-d': [{ estimated1rm: 100 }],
        'ex-e': [],
      },
    }) as unknown as Internals;
    expect(await service.isE1rmStagnant('s1')).toBe(true);
  });

  it('does not fire below the 60% threshold', async () => {
    // 3 evaluable, 1 stagnant (33%).
    const service = serviceWith({
      program: programWith(['ex-a', 'ex-b', 'ex-c']),
      setLogsByExercise: {
        'ex-a': [{ estimated1rm: 120 }, { estimated1rm: 110 }],
        'ex-b': [{ estimated1rm: 100 }, { estimated1rm: 130 }],
        'ex-c': [{ estimated1rm: 100 }, { estimated1rm: 140 }],
      },
    }) as unknown as Internals;
    expect(await service.isE1rmStagnant('s1')).toBe(false);
  });
});

describe('DashboardService — soreness/stress', () => {
  const monday = new Date('2026-08-24T00:00:00Z');
  const previousMonday = new Date(monday.getTime() - 7 * DAY);
  const twoWeeksBefore = new Date(monday.getTime() - 14 * DAY);

  it('fires on two consecutive weeks above the threshold', async () => {
    const service = serviceWith({
      checkIns: [
        { weekStart: monday, soreness: 5, stress: 1 },
        { weekStart: previousMonday, soreness: 4, stress: 2 },
      ],
    }) as unknown as Internals;
    expect(await service.isSorenessOrStressHigh('s1')).toBe(true);
  });

  it('accepts stress alone as the high signal', async () => {
    const service = serviceWith({
      checkIns: [
        { weekStart: monday, soreness: 1, stress: 4 },
        { weekStart: previousMonday, soreness: 2, stress: 5 },
      ],
    }) as unknown as Internals;
    expect(await service.isSorenessOrStressHigh('s1')).toBe(true);
  });

  it('does not fire when the two high weeks are not adjacent', async () => {
    const service = serviceWith({
      checkIns: [
        { weekStart: monday, soreness: 5, stress: 1 },
        { weekStart: twoWeeksBefore, soreness: 5, stress: 1 },
      ],
    }) as unknown as Internals;
    expect(await service.isSorenessOrStressHigh('s1')).toBe(false);
  });

  it('does not fire on a single high week', async () => {
    const service = serviceWith({
      checkIns: [
        { weekStart: monday, soreness: 5, stress: 1 },
        { weekStart: previousMonday, soreness: 2, stress: 2 },
      ],
    }) as unknown as Internals;
    expect(await service.isSorenessOrStressHigh('s1')).toBe(false);
  });

  it('treats a null slider as below the threshold', async () => {
    const service = serviceWith({
      checkIns: [
        { weekStart: monday, soreness: null, stress: null },
        { weekStart: previousMonday, soreness: 5, stress: null },
      ],
    }) as unknown as Internals;
    expect(await service.isSorenessOrStressHigh('s1')).toBe(false);
  });

  it('does not fire with no check-ins at all', async () => {
    const service = serviceWith({}) as unknown as Internals;
    expect(await service.isSorenessOrStressHigh('s1')).toBe(false);
  });
});
