import { loadIncrementFor, roundToIncrement } from './rounding';

describe('loadIncrementFor', () => {
  it('uses 2.5 kg on the bar and 1 kg everywhere else', () => {
    expect(loadIncrementFor('BARBELL')).toBe(2.5);
    expect(loadIncrementFor('SMITH')).toBe(2.5);
    expect(loadIncrementFor('DUMBBELL')).toBe(1);
    expect(loadIncrementFor('MACHINE')).toBe(1);
    expect(loadIncrementFor('CABLE')).toBe(1);
  });
});

describe('roundToIncrement', () => {
  it('snaps to the nearest plate step', () => {
    expect(roundToIncrement(101.2, 2.5)).toBe(100);
    expect(roundToIncrement(101.3, 2.5)).toBe(102.5);
    expect(roundToIncrement(84, 2.5)).toBe(85);
  });

  it('snaps to whole kilos for dumbbells', () => {
    expect(roundToIncrement(22.4, 1)).toBe(22);
    expect(roundToIncrement(22.6, 1)).toBe(23);
  });

  it('does not leak float drift', () => {
    expect(roundToIncrement(0.1 + 0.2, 2.5)).toBe(0);
    expect(Number.isInteger(roundToIncrement(7.5, 2.5) * 10)).toBe(true);
  });
});
