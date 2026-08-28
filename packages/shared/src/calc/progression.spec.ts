import { suggestNextLoad } from './progression';

describe('suggestNextLoad', () => {
  it('suggests +5% for a lower body compound that met the increase criteria', () => {
    const result = suggestNextLoad({
      movementPattern: 'SQUAT',
      equipment: 'BARBELL',
      lastLoadKg: 100,
      metIncreaseCriteria: true,
      failedMinRepsLastTwoSessions: false,
    });
    expect(result.direction).toBe('INCREASE');
    expect(result.pct).toBe(0.05);
    // 100 * 1.05 = 105, already a multiple of 2.5
    expect(result.suggestedLoadKg).toBe(105);
  });

  it('suggests +2.5% for an upper body / isolation movement that met the increase criteria', () => {
    const result = suggestNextLoad({
      movementPattern: 'ISOLATION',
      equipment: 'DUMBBELL',
      lastLoadKg: 20,
      metIncreaseCriteria: true,
      failedMinRepsLastTwoSessions: false,
    });
    expect(result.direction).toBe('INCREASE');
    expect(result.pct).toBe(0.025);
    // 20 * 1.025 = 20.5 -> rounds to nearest 1 kg (dumbbell)
    expect(result.suggestedLoadKg).toBe(21);
  });

  it('suggests -10% after failing the minimum rep range twice in a row', () => {
    const result = suggestNextLoad({
      movementPattern: 'HORIZONTAL_PUSH',
      equipment: 'BARBELL',
      lastLoadKg: 60,
      metIncreaseCriteria: false,
      failedMinRepsLastTwoSessions: true,
    });
    expect(result.direction).toBe('DECREASE');
    expect(result.pct).toBe(-0.1);
    // 60 * 0.9 = 54 -> rounds to the nearest 2.5 kg (barbell), 55
    expect(result.suggestedLoadKg).toBe(55);
  });

  it('holds with no suggestion when neither criterion is met', () => {
    const result = suggestNextLoad({
      movementPattern: 'HORIZONTAL_PUSH',
      equipment: 'BARBELL',
      lastLoadKg: 60,
      metIncreaseCriteria: false,
      failedMinRepsLastTwoSessions: false,
    });
    expect(result).toEqual({ direction: 'HOLD', suggestedLoadKg: null, pct: 0 });
  });

  it('increase takes precedence when both criteria are somehow true', () => {
    const result = suggestNextLoad({
      movementPattern: 'SQUAT',
      equipment: 'BARBELL',
      lastLoadKg: 100,
      metIncreaseCriteria: true,
      failedMinRepsLastTwoSessions: true,
    });
    expect(result.direction).toBe('INCREASE');
  });

  it('holds with no data when there is no last load to project from', () => {
    const result = suggestNextLoad({
      movementPattern: 'SQUAT',
      equipment: 'BARBELL',
      lastLoadKg: null,
      metIncreaseCriteria: true,
      failedMinRepsLastTwoSessions: false,
    });
    expect(result).toEqual({ direction: 'HOLD', suggestedLoadKg: null, pct: 0 });
  });
});
