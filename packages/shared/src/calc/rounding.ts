/** Load rounding — spec §6: barbell moves in 2.5 kg steps, dumbbell/machine in 1 kg. */

export type LoadIncrementKg = 2.5 | 1;

/** Equipment values that live on a bar and therefore round to 2.5 kg. */
const BARBELL_LIKE = new Set(['BARBELL', 'SMITH']);

export function loadIncrementFor(equipment: string): LoadIncrementKg {
  return BARBELL_LIKE.has(equipment) ? 2.5 : 1;
}

/** Rounds to the nearest multiple of `increment`, avoiding float drift (2.5 -> 0.1 units). */
export function roundToIncrement(valueKg: number, increment: LoadIncrementKg): number {
  const steps = Math.round(valueKg / increment);
  return Number((steps * increment).toFixed(3));
}
