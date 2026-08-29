import type { PrescribedSetDto } from '@pt/shared';
import { formatWeight } from '@/lib/format';

/** "8–10 reps · 60 kg · RIR 2" — what this particular set asks for. */
export function formatSetTarget(set: PrescribedSetDto | undefined): string {
  if (!set) return 'Série extra';

  const parts: string[] = [];
  const reps = formatRepRange(set);
  if (reps) parts.push(`${reps} reps`);
  if (set.targetSeconds != null) parts.push(`${set.targetSeconds}s`);
  if (set.targetDistanceM != null) parts.push(`${set.targetDistanceM} m`);
  if (set.targetLoadKg != null) parts.push(formatWeight(set.targetLoadKg));
  if (set.targetRir != null) parts.push(`RIR ${set.targetRir}`);
  if (set.targetRpe != null) parts.push(`RPE ${set.targetRpe}`);

  return parts.length > 0 ? parts.join(' · ') : 'Sem alvo definido';
}

export function formatRepRange(set: PrescribedSetDto): string | null {
  if (set.repsMin == null && set.repsMax == null) return null;
  if (set.repsMin != null && set.repsMax != null && set.repsMin !== set.repsMax) {
    return `${set.repsMin}–${set.repsMax}`;
  }
  return String(set.repsMax ?? set.repsMin);
}

/** "4 × 8–10" — the one-line summary shown next to the exercise name. */
export function summarizePrescription(sets: PrescribedSetDto[]): string {
  if (sets.length === 0) return 'Sem séries prescritas';
  const working = sets.filter((set) => set.setType !== 'WARMUP');
  const reference = working[0] ?? sets[0]!;
  const range = formatRepRange(reference);
  return range ? `${sets.length} × ${range}` : `${sets.length} séries`;
}

export function formatRest(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}min` : `${minutes}min${String(rest).padStart(2, '0')}`;
}

/** The rest this set is entitled to: a per-set override wins over the exercise default. */
export function restSecondsFor(
  set: PrescribedSetDto | undefined,
  exerciseRestSeconds: number | null,
): number {
  return set?.restSecondsOverride ?? exerciseRestSeconds ?? 0;
}
