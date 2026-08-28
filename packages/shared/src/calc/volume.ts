import { type SetType } from './types';

/** Set types that count towards session tonnage — warm-ups never do (spec §7). */
const TONNAGE_SET_TYPES: ReadonlySet<SetType> = new Set<SetType>(['WORK', 'BACKOFF']);

export function countsTowardsTonnage(setType: SetType): boolean {
  return TONNAGE_SET_TYPES.has(setType);
}

/** Volume of one set: `reps × loadKg`. Bodyweight/time/distance sets contribute 0. */
export function setVolumeKg(reps: number | null | undefined, loadKg: number | null | undefined) {
  if (reps == null || loadKg == null) return 0;
  if (!Number.isFinite(reps) || !Number.isFinite(loadKg)) return 0;
  if (reps <= 0 || loadKg <= 0) return 0;
  return reps * loadKg;
}

export interface TonnageInput {
  setType: SetType;
  reps?: number | null;
  loadKg?: number | null;
}

/** Session tonnage: sum of the volume of every WORK and BACKOFF set. */
export function sessionTonnageKg(sets: readonly TonnageInput[]): number {
  return sets.reduce(
    (total, set) =>
      countsTowardsTonnage(set.setType) ? total + setVolumeKg(set.reps, set.loadKg) : total,
    0,
  );
}
