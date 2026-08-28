import {
  type Equipment,
  type LoadType,
  type MovementPattern,
  type MuscleGroup,
} from '@prisma/client';
import { slugify } from '../../src/common/util/slugify';
import { type FreeExerciseDbEntry } from './source-types';

/**
 * The source has no `movementPattern` equivalent. Priority-ordered keyword match on the
 * exercise name (most reliable signal), falling back to `category`/`mechanic`/`force`.
 * Not perfectly accurate for all ~870 entries by design (see M2 plan) — a trainer can
 * correct any entry later via `PATCH /exercises/:id`.
 */
const NAME_PATTERNS: Array<[RegExp, MovementPattern]> = [
  [/\bsquat\b/i, 'SQUAT'],
  [/\b(deadlift|rdl|good\s*morning)\b/i, 'HINGE'],
  [/\b(lunge|split\s*squat|step[\s-]?up)\b/i, 'LUNGE'],
  [/\b(farmer|\bcarry\b|yoke)\b/i, 'CARRY'],
  [/\b(twist|rotation|chop|russian\b)\b/i, 'ROTATION'],
  [/\b(pulldown|pull[\s-]?up|chin[\s-]?up|lat\s*pull)\b/i, 'VERTICAL_PULL'],
  [/\b(overhead\s*press|shoulder\s*press|military\s*press|push\s*press)\b/i, 'VERTICAL_PUSH'],
  [/\brow\b/i, 'HORIZONTAL_PULL'],
  [/\b(bench|chest\s*press|push[\s-]?up|dip|fly|flye)\b/i, 'HORIZONTAL_PUSH'],
];

export function mapMovementPattern(entry: FreeExerciseDbEntry): MovementPattern {
  for (const [pattern, movementPattern] of NAME_PATTERNS) {
    if (pattern.test(entry.name)) return movementPattern;
  }
  if (entry.category === 'stretching') return 'MOBILITY';
  if (['cardio', 'plyometrics', 'strongman'].includes(entry.category)) return 'CONDITIONING';
  if (entry.mechanic === 'isolation') return 'ISOLATION';
  if (entry.force === 'push') return 'HORIZONTAL_PUSH';
  if (entry.force === 'pull') return 'HORIZONTAL_PULL';
  return 'ISOLATION';
}

const EQUIPMENT_MAP: Record<string, Equipment> = {
  'body only': 'BODYWEIGHT',
  barbell: 'BARBELL',
  dumbbell: 'DUMBBELL',
  kettlebells: 'KETTLEBELL',
  cable: 'CABLE',
  machine: 'MACHINE',
  bands: 'BAND',
  'exercise ball': 'OTHER',
  'foam roll': 'OTHER',
  'medicine ball': 'MEDICINE_BALL',
  'e-z curl bar': 'BARBELL',
  other: 'OTHER',
};

export function mapEquipment(source: string | null): Equipment {
  if (!source) return 'OTHER';
  return EQUIPMENT_MAP[source] ?? 'OTHER';
}

export function mapLoadType(equipment: Equipment): LoadType {
  return equipment === 'BODYWEIGHT' ? 'BODYWEIGHT' : 'EXTERNAL';
}

export function mapUnilateral(name: string): boolean {
  return /\b(single[\s-]?(arm|leg)|one[\s-]?(arm|leg)|alternat(e|ing))\b/i.test(name);
}

const MUSCLE_MAP: Record<string, MuscleGroup> = {
  abdominals: 'ABS',
  abductors: 'ABDUCTORS',
  adductors: 'ADDUCTORS',
  biceps: 'BICEPS',
  calves: 'CALVES',
  chest: 'CHEST',
  forearms: 'FOREARMS',
  glutes: 'GLUTES',
  hamstrings: 'HAMSTRINGS',
  lats: 'BACK',
  'lower back': 'LOWER_BACK',
  'middle back': 'BACK',
  neck: 'NECK',
  quadriceps: 'QUADS',
  shoulders: 'SHOULDERS',
  traps: 'TRAPS',
  triceps: 'TRICEPS',
};

/** `null` for a muscle name the source vocabulary doesn't have today — skipped, not fatal. */
export function mapMuscle(source: string): MuscleGroup | null {
  return MUSCLE_MAP[source] ?? null;
}

export interface MappedExercise {
  slug: string;
  name: string;
  instructions: string | null;
  movementPattern: MovementPattern;
  equipment: Equipment;
  loadType: LoadType;
  unilateral: boolean;
  muscles: Array<{ muscle: MuscleGroup; role: 'PRIMARY' | 'SECONDARY' }>;
}

export function mapExercise(entry: FreeExerciseDbEntry): MappedExercise {
  const equipment = mapEquipment(entry.equipment);
  const muscles: MappedExercise['muscles'] = [];
  const seen = new Set<MuscleGroup>();

  const addMuscles = (names: string[], role: 'PRIMARY' | 'SECONDARY') => {
    for (const name of names) {
      const muscle = mapMuscle(name);
      if (muscle && !seen.has(muscle)) {
        muscles.push({ muscle, role });
        seen.add(muscle);
      }
    }
  };
  addMuscles(entry.primaryMuscles, 'PRIMARY');
  addMuscles(entry.secondaryMuscles, 'SECONDARY');

  return {
    slug: slugify(entry.name),
    name: entry.name,
    instructions: entry.instructions.length > 0 ? entry.instructions.join(' ') : null,
    movementPattern: mapMovementPattern(entry),
    equipment,
    loadType: mapLoadType(equipment),
    unilateral: mapUnilateral(entry.name),
    muscles,
  };
}
