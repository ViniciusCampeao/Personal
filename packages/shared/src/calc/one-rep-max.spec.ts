import { brzycki1rm, epley1rm, estimate1rm, MAX_REPS_FOR_E1RM } from './one-rep-max';

describe('epley1rm', () => {
  it('applies load x (1 + reps / 30)', () => {
    expect(epley1rm(100, 5)).toBeCloseTo(116.6667, 4);
    expect(epley1rm(80, 8)).toBeCloseTo(101.3333, 4);
    expect(epley1rm(60, 12)).toBeCloseTo(84, 4);
  });

  it('treats a single rep as the 1RM itself', () => {
    expect(epley1rm(140, 1)).toBe(140);
  });

  it('returns null above 12 reps, where the estimate is worthless', () => {
    expect(epley1rm(100, MAX_REPS_FOR_E1RM)).not.toBeNull();
    expect(epley1rm(100, MAX_REPS_FOR_E1RM + 1)).toBeNull();
    expect(epley1rm(100, 20)).toBeNull();
  });

  it('rejects non-positive, fractional and non-finite inputs', () => {
    expect(epley1rm(0, 5)).toBeNull();
    expect(epley1rm(-100, 5)).toBeNull();
    expect(epley1rm(100, 0)).toBeNull();
    expect(epley1rm(100, 5.5)).toBeNull();
    expect(epley1rm(Number.NaN, 5)).toBeNull();
    expect(epley1rm(100, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('grows monotonically with load and with reps', () => {
    expect(epley1rm(100, 5)!).toBeGreaterThan(epley1rm(95, 5)!);
    expect(epley1rm(100, 6)!).toBeGreaterThan(epley1rm(100, 5)!);
  });
});

describe('brzycki1rm', () => {
  it('applies load x 36 / (37 - reps)', () => {
    expect(brzycki1rm(100, 5)).toBeCloseTo(112.5, 6);
    expect(brzycki1rm(100, 10)).toBeCloseTo(133.3333, 4);
  });

  it('treats a single rep as the 1RM itself', () => {
    expect(brzycki1rm(140, 1)).toBe(140);
  });

  it('returns null above 12 reps', () => {
    expect(brzycki1rm(100, 13)).toBeNull();
  });
});

describe('estimate1rm', () => {
  it('defaults to Epley', () => {
    expect(estimate1rm(100, 5)).toBe(epley1rm(100, 5));
  });

  it('switches to Brzycki on request', () => {
    expect(estimate1rm(100, 5, 'BRZYCKI')).toBe(brzycki1rm(100, 5));
  });
});
