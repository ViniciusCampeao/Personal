import { mapEquipment, mapExercise, mapMovementPattern, mapMuscle, mapUnilateral } from './map';
import { type FreeExerciseDbEntry } from './source-types';

function entry(overrides: Partial<FreeExerciseDbEntry>): FreeExerciseDbEntry {
  return {
    id: 'Test_Exercise',
    name: 'Test Exercise',
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

describe('mapMovementPattern', () => {
  it('recognizes a squat by name', () => {
    expect(mapMovementPattern(entry({ name: 'Barbell Back Squat' }))).toBe('SQUAT');
  });

  it('recognizes a deadlift as a hinge', () => {
    expect(mapMovementPattern(entry({ name: 'Romanian Deadlift' }))).toBe('HINGE');
  });

  it('maps isolation mechanic when no keyword matches', () => {
    expect(mapMovementPattern(entry({ name: 'Barbell Curl', mechanic: 'isolation' }))).toBe(
      'ISOLATION',
    );
  });

  it('maps stretching category to mobility', () => {
    expect(mapMovementPattern(entry({ name: 'Hamstring Stretch', category: 'stretching' }))).toBe(
      'MOBILITY',
    );
  });

  it('maps cardio/plyometrics/strongman category to conditioning', () => {
    expect(mapMovementPattern(entry({ name: 'Box Jump', category: 'plyometrics' }))).toBe(
      'CONDITIONING',
    );
  });

  it('falls back to isolation when nothing else matches', () => {
    expect(mapMovementPattern(entry({ name: 'Something Unusual' }))).toBe('ISOLATION');
  });
});

describe('mapEquipment', () => {
  it('maps known source values', () => {
    expect(mapEquipment('body only')).toBe('BODYWEIGHT');
    expect(mapEquipment('e-z curl bar')).toBe('BARBELL');
  });

  it('falls back to OTHER for null or unknown', () => {
    expect(mapEquipment(null)).toBe('OTHER');
    expect(mapEquipment('something-new')).toBe('OTHER');
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
  it('dedupes a muscle that appears in both primary and secondary, keeping PRIMARY', () => {
    const result = mapExercise(
      entry({ primaryMuscles: ['chest'], secondaryMuscles: ['chest', 'triceps'] }),
    );
    expect(result.muscles).toEqual([
      { muscle: 'CHEST', role: 'PRIMARY' },
      { muscle: 'TRICEPS', role: 'SECONDARY' },
    ]);
  });

  it('joins multi-step instructions and slugifies the name', () => {
    const result = mapExercise(
      entry({ name: 'Air Bike', instructions: ['Step one.', 'Step two.'] }),
    );
    expect(result.slug).toBe('air-bike');
    expect(result.instructions).toBe('Step one. Step two.');
  });
});
