import { loadIncrementFor, roundToIncrement } from './rounding';

/** Double-progression suggestion (spec §6) — a suggestion, never a forced load. */

export type ProgressionDirection = 'INCREASE' | 'DECREASE' | 'HOLD';

/** Movement patterns treated as "lower body / heavy compound" for the +5% branch. */
const LOWER_BODY_COMPOUND_PATTERNS = new Set(['SQUAT', 'HINGE', 'LUNGE']);

export interface ProgressionSuggestionInput {
  movementPattern: string;
  equipment: string;
  lastLoadKg: number | null;
  /**
   * True when the most recent WORK-set session met the increase criteria: every WORK
   * set reached the prescription's `repsMax` and every reported RIR was >= `targetRir`.
   * Pass `false` when the prescription doesn't define both targets — there's nothing to
   * evaluate either way.
   */
  metIncreaseCriteria: boolean;
  /** True when each of the last two consecutive WORK-set sessions had a set below `repsMin`. */
  failedMinRepsLastTwoSessions: boolean;
}

export interface ProgressionSuggestion {
  direction: ProgressionDirection;
  suggestedLoadKg: number | null;
  pct: number;
}

export function suggestNextLoad(input: ProgressionSuggestionInput): ProgressionSuggestion {
  if (input.lastLoadKg == null || input.lastLoadKg <= 0) {
    return { direction: 'HOLD', suggestedLoadKg: null, pct: 0 };
  }

  const increment = loadIncrementFor(input.equipment);

  if (input.metIncreaseCriteria) {
    const pct = LOWER_BODY_COMPOUND_PATTERNS.has(input.movementPattern) ? 0.05 : 0.025;
    return {
      direction: 'INCREASE',
      suggestedLoadKg: roundToIncrement(input.lastLoadKg * (1 + pct), increment),
      pct,
    };
  }

  if (input.failedMinRepsLastTwoSessions) {
    const pct = -0.1;
    return {
      direction: 'DECREASE',
      suggestedLoadKg: roundToIncrement(input.lastLoadKg * (1 + pct), increment),
      pct,
    };
  }

  return { direction: 'HOLD', suggestedLoadKg: null, pct: 0 };
}
