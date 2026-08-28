/**
 * Shared vocabulary for the pure calculation helpers.
 *
 * These string unions mirror the Prisma enums on purpose: `packages/shared` must stay
 * dependency-free so the browser can run the exact same math offline.
 */

export type Sex = 'MALE' | 'FEMALE';

export type SkinfoldProtocol = 'NONE' | 'POLLOCK_3' | 'POLLOCK_7' | 'GUEDES' | 'FAULKNER';

export type SkinfoldSite =
  'TRICEPS' | 'SUBSCAPULAR' | 'CHEST' | 'MIDAXILLARY' | 'SUPRAILIAC' | 'ABDOMINAL' | 'THIGH';

/** Set types that count towards session tonnage (see `sessionTonnageKg`). */
export type SetType = 'WARMUP' | 'WORK' | 'BACKOFF' | 'DROP' | 'FAILURE';

/** Thrown when the caller did not provide enough data to run a calculation. */
export class CalcValidationError extends Error {
  constructor(
    message: string,
    readonly details: { missingSites?: SkinfoldSite[]; missingFields?: string[] } = {},
  ) {
    super(message);
    this.name = 'CalcValidationError';
  }
}

/** Thrown when a protocol exists in the domain but has no formula wired up yet. */
export class UnsupportedProtocolError extends Error {
  constructor(readonly protocol: string) {
    super(`Skinfold protocol "${protocol}" has no implemented formula.`);
    this.name = 'UnsupportedProtocolError';
  }
}
