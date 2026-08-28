import { countsTowardsTonnage, sessionTonnageKg, setVolumeKg } from './volume';

describe('setVolumeKg', () => {
  it('multiplies reps by load', () => {
    expect(setVolumeKg(10, 60)).toBe(600);
  });

  it('is zero when there is no external load or no reps', () => {
    expect(setVolumeKg(10, null)).toBe(0);
    expect(setVolumeKg(null, 60)).toBe(0);
    expect(setVolumeKg(undefined, undefined)).toBe(0);
    expect(setVolumeKg(0, 60)).toBe(0);
    expect(setVolumeKg(10, 0)).toBe(0);
    expect(setVolumeKg(10, Number.NaN)).toBe(0);
  });
});

describe('countsTowardsTonnage', () => {
  it('counts WORK and BACKOFF only', () => {
    expect(countsTowardsTonnage('WORK')).toBe(true);
    expect(countsTowardsTonnage('BACKOFF')).toBe(true);
    expect(countsTowardsTonnage('WARMUP')).toBe(false);
    expect(countsTowardsTonnage('DROP')).toBe(false);
    expect(countsTowardsTonnage('FAILURE')).toBe(false);
  });
});

describe('sessionTonnageKg', () => {
  it('sums WORK and BACKOFF and ignores warm-ups', () => {
    const tonnage = sessionTonnageKg([
      { setType: 'WARMUP', reps: 10, loadKg: 40 },
      { setType: 'WORK', reps: 8, loadKg: 80 },
      { setType: 'WORK', reps: 8, loadKg: 80 },
      { setType: 'BACKOFF', reps: 12, loadKg: 60 },
      { setType: 'DROP', reps: 15, loadKg: 30 },
    ]);
    expect(tonnage).toBe(8 * 80 + 8 * 80 + 12 * 60);
  });

  it('is zero for an empty session', () => {
    expect(sessionTonnageKg([])).toBe(0);
  });

  it('ignores bodyweight sets that carry no load', () => {
    expect(sessionTonnageKg([{ setType: 'WORK', reps: 20, loadKg: null }])).toBe(0);
  });
});
