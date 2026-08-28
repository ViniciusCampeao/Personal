import {
  bmi,
  calculateBodyComposition,
  faulknerBodyFatPct,
  fatMassKg,
  leanMassKg,
  pollock3Density,
  pollock7Density,
  requiredSkinfoldSites,
  siriBodyFatPct,
} from './body-composition';
import { CalcValidationError, UnsupportedProtocolError } from './types';

describe('requiredSkinfoldSites', () => {
  it('uses sex-specific sites for Pollock 3', () => {
    expect(requiredSkinfoldSites('POLLOCK_3', 'MALE')).toEqual(['CHEST', 'ABDOMINAL', 'THIGH']);
    expect(requiredSkinfoldSites('POLLOCK_3', 'FEMALE')).toEqual([
      'TRICEPS',
      'SUPRAILIAC',
      'THIGH',
    ]);
  });

  it('uses the same seven sites for both sexes on Pollock 7', () => {
    expect(requiredSkinfoldSites('POLLOCK_7', 'MALE')).toHaveLength(7);
    expect(requiredSkinfoldSites('POLLOCK_7', 'MALE')).toEqual(
      requiredSkinfoldSites('POLLOCK_7', 'FEMALE'),
    );
  });

  it('requires four sites for Faulkner and none for NONE', () => {
    expect(requiredSkinfoldSites('FAULKNER', 'MALE')).toEqual([
      'TRICEPS',
      'SUBSCAPULAR',
      'SUPRAILIAC',
      'ABDOMINAL',
    ]);
    expect(requiredSkinfoldSites('NONE', 'MALE')).toEqual([]);
  });

  it('refuses GUEDES until its constants are pinned by the spec', () => {
    expect(() => requiredSkinfoldSites('GUEDES', 'MALE')).toThrow(UnsupportedProtocolError);
  });
});

describe('density formulas against reference values', () => {
  // Reference values recomputed from the regression equations in spec §7, kept as
  // literals so a typo in a constant fails the suite instead of moving with the code.
  it('Pollock 3, male, sum 47 mm, 30 years', () => {
    const density = pollock3Density('MALE', 47, 30);
    expect(density).toBeCloseTo(1.0663375, 7);
    expect(siriBodyFatPct(density)).toBeCloseTo(14.2058, 4);
  });

  it('Pollock 3, female, sum 56 mm, 25 years', () => {
    const density = pollock3Density('FEMALE', 56, 25);
    expect(density).toBeCloseTo(1.0476225, 7);
    expect(siriBodyFatPct(density)).toBeCloseTo(22.4984, 4);
  });

  it('Pollock 7, male, sum 88 mm, 35 years', () => {
    const density = pollock7Density('MALE', 88, 35);
    expect(density).toBeCloseTo(1.067891, 6);
    expect(siriBodyFatPct(density)).toBeCloseTo(13.5305, 4);
  });

  it('Pollock 7, female, sum 116 mm, 28 years', () => {
    const density = pollock7Density('FEMALE', 116, 28);
    expect(density).toBeCloseTo(1.0464572, 7);
    expect(siriBodyFatPct(density)).toBeCloseTo(23.0246, 4);
  });

  it('body fat rises as skinfolds thicken and as age rises', () => {
    expect(siriBodyFatPct(pollock3Density('MALE', 60, 30))).toBeGreaterThan(
      siriBodyFatPct(pollock3Density('MALE', 47, 30)),
    );
    expect(siriBodyFatPct(pollock3Density('MALE', 47, 45))).toBeGreaterThan(
      siriBodyFatPct(pollock3Density('MALE', 47, 30)),
    );
  });
});

describe('faulknerBodyFatPct', () => {
  it('applies sum x 0.153 + 5.783', () => {
    expect(faulknerBodyFatPct(60)).toBeCloseTo(14.963, 6);
    expect(faulknerBodyFatPct(0)).toBeCloseTo(5.783, 6);
  });
});

describe('bmi / fat mass / lean mass', () => {
  it('computes BMI from kg and cm', () => {
    expect(bmi(80, 180)).toBeCloseTo(24.6914, 4);
  });

  it('splits weight into fat and lean mass', () => {
    expect(fatMassKg(80, 15)).toBeCloseTo(12, 6);
    expect(leanMassKg(80, 15)).toBeCloseTo(68, 6);
    expect(fatMassKg(80, 15) + leanMassKg(80, 15)).toBeCloseTo(80, 6);
  });
});

describe('calculateBodyComposition', () => {
  const maleP3 = {
    protocol: 'POLLOCK_3' as const,
    sex: 'MALE' as const,
    ageYears: 30,
    skinfoldsMm: { CHEST: 12, ABDOMINAL: 20, THIGH: 15 },
    weightKg: 80,
    heightCm: 180,
  };

  it('runs the full chain for Pollock 3', () => {
    const result = calculateBodyComposition(maleP3);
    expect(result.sumMm).toBe(47);
    expect(result.bodyDensity).toBeCloseTo(1.0663375, 7);
    expect(result.bodyFatPct).toBeCloseTo(14.2058, 4);
    expect(result.fatMassKg).toBeCloseTo(11.3646, 4);
    expect(result.leanMassKg).toBeCloseTo(68.6354, 4);
    expect(result.bmi).toBeCloseTo(24.6914, 4);
  });

  it('skips the density step for Faulkner', () => {
    const result = calculateBodyComposition({
      protocol: 'FAULKNER',
      sex: 'FEMALE',
      skinfoldsMm: { TRICEPS: 20, SUBSCAPULAR: 15, SUPRAILIAC: 15, ABDOMINAL: 10 },
      weightKg: 60,
    });
    expect(result.sumMm).toBe(60);
    expect(result.bodyDensity).toBeNull();
    expect(result.bodyFatPct).toBeCloseTo(14.963, 4);
  });

  it('returns BMI only when the protocol is NONE', () => {
    const result = calculateBodyComposition({
      protocol: 'NONE',
      sex: 'MALE',
      weightKg: 80,
      heightCm: 180,
    });
    expect(result.bodyFatPct).toBeNull();
    expect(result.sumMm).toBeNull();
    expect(result.bmi).toBeCloseTo(24.6914, 4);
  });

  it('names every missing skinfold site (-> 422)', () => {
    expect.assertions(2);
    try {
      calculateBodyComposition({ ...maleP3, skinfoldsMm: { CHEST: 12 } });
    } catch (error) {
      expect(error).toBeInstanceOf(CalcValidationError);
      expect((error as CalcValidationError).details.missingSites).toEqual(['ABDOMINAL', 'THIGH']);
    }
  });

  it('treats a non-positive skinfold as missing', () => {
    expect(() =>
      calculateBodyComposition({ ...maleP3, skinfoldsMm: { CHEST: 12, ABDOMINAL: 0, THIGH: 15 } }),
    ).toThrow(CalcValidationError);
  });

  it('demands age for Pollock protocols', () => {
    expect.assertions(2);
    try {
      calculateBodyComposition({ ...maleP3, ageYears: null });
    } catch (error) {
      expect(error).toBeInstanceOf(CalcValidationError);
      expect((error as CalcValidationError).details.missingFields).toEqual(['ageYears']);
    }
  });

  it('does not demand age for Faulkner', () => {
    expect(() =>
      calculateBodyComposition({
        protocol: 'FAULKNER',
        sex: 'MALE',
        skinfoldsMm: { TRICEPS: 20, SUBSCAPULAR: 15, SUPRAILIAC: 15, ABDOMINAL: 10 },
      }),
    ).not.toThrow();
  });

  it('leaves mass split null when weight is unknown', () => {
    const result = calculateBodyComposition({ ...maleP3, weightKg: null, heightCm: null });
    expect(result.fatMassKg).toBeNull();
    expect(result.leanMassKg).toBeNull();
    expect(result.bmi).toBeNull();
  });
});
