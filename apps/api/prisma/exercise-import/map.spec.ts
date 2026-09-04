import { mapExercise, mapLoadType, mapMuscle, mapUnilateral } from './map';
import { type FreeExerciseDbEntry } from './source-types';

function entry(overrides: Partial<FreeExerciseDbEntry>): FreeExerciseDbEntry {
  return {
    id: 'Test_Exercise',
    name: 'Barbell Squat', // in the catalog, so mapExercise returns a row by default
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: null,
    primaryMuscles: [],
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
    ...overrides,
  };
}

describe('mapLoadType', () => {
  it('loads bodyweight and cardio differently from external weight', () => {
    expect(mapLoadType('BODYWEIGHT')).toBe('BODYWEIGHT');
    expect(mapLoadType('CARDIO_MACHINE')).toBe('TIME');
    expect(mapLoadType('BARBELL')).toBe('EXTERNAL');
  });
});

describe('mapMuscle', () => {
  it('maps the full known vocabulary', () => {
    expect(mapMuscle('lats')).toBe('BACK');
    expect(mapMuscle('abdominals')).toBe('ABS');
  });

  it('returns null for an unmapped value instead of throwing', () => {
    expect(mapMuscle('something-new')).toBeNull();
  });
});

describe('mapUnilateral', () => {
  it('detects single-limb exercises by name', () => {
    expect(mapUnilateral('Alternating Dumbbell Curl')).toBe(true);
    expect(mapUnilateral('Single-Leg Romanian Deadlift')).toBe(true);
    expect(mapUnilateral('Barbell Bench Press')).toBe(false);
  });
});

describe('mapExercise', () => {
  it('skips an exercise the catalog does not admit', () => {
    expect(mapExercise(entry({ name: 'Circus Bell' }))).toBeNull();
  });

  it('takes name, pattern and equipment from the catalog, not from the source', () => {
    // The source calls this one `machine`; the catalog is what knows it is a Smith bar.
    const result = mapExercise(entry({ name: 'Smith Machine Squat', equipment: 'machine' }));
    expect(result).toMatchObject({
      name: 'Agachamento no Smith',
      movementPattern: 'SQUAT',
      equipment: 'SMITH',
      loadType: 'EXTERNAL',
    });
  });

  it('dedupes a muscle that appears in both primary and secondary, keeping PRIMARY', () => {
    const result = mapExercise(
      entry({ primaryMuscles: ['chest'], secondaryMuscles: ['chest', 'triceps'] }),
    );
    expect(result?.muscles).toEqual([
      { muscle: 'CHEST', role: 'PRIMARY' },
      { muscle: 'TRICEPS', role: 'SECONDARY' },
    ]);
  });

  it('joins multi-step instructions and slugifies the English name', () => {
    const result = mapExercise(
      entry({ name: 'Air Bike', instructions: ['Step one.', 'Step two.'] }),
    );
    expect(result?.slug).toBe('air-bike');
    expect(result?.instructions).toBe('Step one. Step two.');
  });
});
