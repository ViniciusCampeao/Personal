/** Estimated 1RM (e1RM) formulas — spec §7. */

/** Above this rep count the estimate stops being trustworthy and we return `null`. */
export const MAX_REPS_FOR_E1RM = 12;

export type OneRepMaxFormula = 'EPLEY' | 'BRZYCKI';

function isEstimable(loadKg: number, reps: number): boolean {
  return (
    Number.isFinite(loadKg) &&
    Number.isFinite(reps) &&
    loadKg > 0 &&
    Number.isInteger(reps) &&
    reps >= 1 &&
    reps <= MAX_REPS_FOR_E1RM
  );
}

/**
 * Epley: `load × (1 + reps / 30)`.
 *
 * A single rep IS the 1RM, so reps === 1 returns the load unchanged instead of the
 * formula's 1.033× inflation. Without this a true 1RM set would register a fake +3.3%
 * PR on the EST_1RM record.
 */
export function epley1rm(loadKg: number, reps: number): number | null {
  if (!isEstimable(loadKg, reps)) return null;
  if (reps === 1) return loadKg;
  return loadKg * (1 + reps / 30);
}

/** Brzycki: `load × 36 / (37 − reps)`. Same reps === 1 identity as Epley. */
export function brzycki1rm(loadKg: number, reps: number): number | null {
  if (!isEstimable(loadKg, reps)) return null;
  if (reps === 1) return loadKg;
  return (loadKg * 36) / (37 - reps);
}

/** Project default is Epley (spec §7). */
export function estimate1rm(
  loadKg: number,
  reps: number,
  formula: OneRepMaxFormula = 'EPLEY',
): number | null {
  return formula === 'BRZYCKI' ? brzycki1rm(loadKg, reps) : epley1rm(loadKg, reps);
}
