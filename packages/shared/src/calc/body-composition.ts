import {
  CalcValidationError,
  UnsupportedProtocolError,
  type Sex,
  type SkinfoldProtocol,
  type SkinfoldSite,
} from './types';

/**
 * Body composition — spec §7.
 *
 * GUEDES is intentionally NOT implemented: the spec lists it in the enum but does not
 * pin its regression constants, and guessing them would silently produce wrong health
 * numbers. Calling it throws `UnsupportedProtocolError`.
 */

export type SupportedSkinfoldProtocol = 'POLLOCK_3' | 'POLLOCK_7' | 'FAULKNER';

const POLLOCK_3_SITES: Record<Sex, SkinfoldSite[]> = {
  MALE: ['CHEST', 'ABDOMINAL', 'THIGH'],
  FEMALE: ['TRICEPS', 'SUPRAILIAC', 'THIGH'],
};

const POLLOCK_7_SITES: SkinfoldSite[] = [
  'SUBSCAPULAR',
  'TRICEPS',
  'CHEST',
  'MIDAXILLARY',
  'SUPRAILIAC',
  'ABDOMINAL',
  'THIGH',
];

const FAULKNER_SITES: SkinfoldSite[] = ['TRICEPS', 'SUBSCAPULAR', 'SUPRAILIAC', 'ABDOMINAL'];

/** Sites the given protocol needs. Empty for NONE. Throws for unimplemented protocols. */
export function requiredSkinfoldSites(protocol: SkinfoldProtocol, sex: Sex): SkinfoldSite[] {
  switch (protocol) {
    case 'NONE':
      return [];
    case 'POLLOCK_3':
      return [...POLLOCK_3_SITES[sex]];
    case 'POLLOCK_7':
      return [...POLLOCK_7_SITES];
    case 'FAULKNER':
      return [...FAULKNER_SITES];
    case 'GUEDES':
      throw new UnsupportedProtocolError(protocol);
  }
}

/** Protocols whose formula needs the subject's age. */
export function protocolRequiresAge(protocol: SkinfoldProtocol): boolean {
  return protocol === 'POLLOCK_3' || protocol === 'POLLOCK_7';
}

/** Siri (1961): `%G = (4.95 / Dc − 4.50) × 100`. */
export function siriBodyFatPct(bodyDensity: number): number {
  return (4.95 / bodyDensity - 4.5) * 100;
}

/** Jackson & Pollock 3-site body density. `sumMm` is the sum of the sex-specific sites. */
export function pollock3Density(sex: Sex, sumMm: number, ageYears: number): number {
  return sex === 'MALE'
    ? 1.10938 - 0.0008267 * sumMm + 0.0000016 * sumMm ** 2 - 0.0002574 * ageYears
    : 1.0994921 - 0.0009929 * sumMm + 0.0000023 * sumMm ** 2 - 0.0001392 * ageYears;
}

/** Jackson & Pollock 7-site body density. */
export function pollock7Density(sex: Sex, sumMm: number, ageYears: number): number {
  return sex === 'MALE'
    ? 1.112 - 0.00043499 * sumMm + 0.00000055 * sumMm ** 2 - 0.00028826 * ageYears
    : 1.097 - 0.00046971 * sumMm + 0.00000056 * sumMm ** 2 - 0.00012828 * ageYears;
}

/** Faulkner: `%G = Σ × 0.153 + 5.783` — goes straight to body fat, no density step. */
export function faulknerBodyFatPct(sumMm: number): number {
  return sumMm * 0.153 + 5.783;
}

export function bmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / heightM ** 2;
}

export function fatMassKg(weightKg: number, bodyFatPct: number): number {
  return (weightKg * bodyFatPct) / 100;
}

export function leanMassKg(weightKg: number, bodyFatPct: number): number {
  return weightKg - fatMassKg(weightKg, bodyFatPct);
}

export interface BodyCompositionInput {
  protocol: SkinfoldProtocol;
  sex: Sex;
  /** Age at assessment time. Required for the Pollock protocols. */
  ageYears?: number | null;
  /** Skinfold thickness in millimetres, keyed by site. */
  skinfoldsMm?: Partial<Record<SkinfoldSite, number>>;
  weightKg?: number | null;
  heightCm?: number | null;
}

export interface BodyCompositionResult {
  /** Sites the protocol consumed, in canonical order. */
  sites: SkinfoldSite[];
  sumMm: number | null;
  bodyDensity: number | null;
  bodyFatPct: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  bmi: number | null;
}

/**
 * Runs the whole assessment math for one protocol.
 *
 * Throws `CalcValidationError` (-> HTTP 422) naming exactly which sites or fields are
 * missing, so the API can tell the trainer what to go measure.
 */
export function calculateBodyComposition(input: BodyCompositionInput): BodyCompositionResult {
  const { protocol, sex, weightKg, heightCm } = input;
  const skinfolds = input.skinfoldsMm ?? {};

  const result: BodyCompositionResult = {
    sites: [],
    sumMm: null,
    bodyDensity: null,
    bodyFatPct: null,
    fatMassKg: null,
    leanMassKg: null,
    bmi: weightKg != null && heightCm != null && heightCm > 0 ? bmi(weightKg, heightCm) : null,
  };

  if (protocol === 'NONE') return result;

  const sites = requiredSkinfoldSites(protocol, sex);
  result.sites = sites;

  const missingSites = sites.filter((site) => {
    const value = skinfolds[site];
    return value == null || !Number.isFinite(value) || value <= 0;
  });
  if (missingSites.length > 0) {
    throw new CalcValidationError(
      `Protocol ${protocol} requires skinfold sites: ${missingSites.join(', ')}.`,
      { missingSites },
    );
  }

  const ageYears = input.ageYears;
  if (protocolRequiresAge(protocol) && (ageYears == null || !Number.isFinite(ageYears))) {
    throw new CalcValidationError(`Protocol ${protocol} requires the subject's age.`, {
      missingFields: ['ageYears'],
    });
  }

  const sumMm = sites.reduce((total, site) => total + (skinfolds[site] as number), 0);
  result.sumMm = sumMm;

  if (protocol === 'FAULKNER') {
    result.bodyFatPct = faulknerBodyFatPct(sumMm);
  } else {
    const density =
      protocol === 'POLLOCK_3'
        ? pollock3Density(sex, sumMm, ageYears as number)
        : pollock7Density(sex, sumMm, ageYears as number);
    result.bodyDensity = density;
    result.bodyFatPct = siriBodyFatPct(density);
  }

  if (weightKg != null && Number.isFinite(weightKg) && result.bodyFatPct != null) {
    result.fatMassKg = fatMassKg(weightKg, result.bodyFatPct);
    result.leanMassKg = leanMassKg(weightKg, result.bodyFatPct);
  }

  return result;
}
