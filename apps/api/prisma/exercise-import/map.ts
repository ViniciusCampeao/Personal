import {
  type Equipment,
  type LoadType,
  type MovementPattern,
  type MuscleGroup,
} from '@prisma/client';
import { slugify } from '../../src/common/util/slugify';
import { CATALOG } from './catalog';
import { type FreeExerciseDbEntry } from './source-types';

const IMAGE_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

/**
 * Turns a source entry into a row, for the entries the catalog admits.
 *
 * Name, movement pattern and equipment come from `catalog.ts` — written by hand, because
 * deriving them from the English name (a token-swap translator and a regex over the name)
 * is what produced "Extensora Leg Leg Unilateral com Máquina" filed under "Isolamento".
 * Everything the source *does* state reliably — muscles, images, instructions — still
 * comes straight from it.
 */

export function mapLoadType(equipment: Equipment): LoadType {
  if (equipment === 'BODYWEIGHT') return 'BODYWEIGHT';
  // A treadmill or bike set is prescribed in minutes; asking for kilos makes no sense.
  if (equipment === 'CARDIO_MACHINE') return 'TIME';
  return 'EXTERNAL';
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
  imageUrls: string[];
}

/** `null` when the entry is outside the curated catalog — the import skips it. */
export function mapExercise(entry: FreeExerciseDbEntry): MappedExercise | null {
  const curated = CATALOG[entry.name];
  if (!curated) return null;

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
    // Derived from the original English name so slugs stay stable across re-imports
    // regardless of how the Portuguese name is later edited.
    slug: slugify(entry.name),
    name: curated.name,
    instructions: entry.instructions.length > 0 ? entry.instructions.join(' ') : null,
    movementPattern: curated.pattern,
    equipment: curated.equipment,
    loadType: mapLoadType(curated.equipment),
    unilateral: mapUnilateral(entry.name),
    muscles,
    imageUrls: entry.images.map((path) => `${IMAGE_BASE_URL}/${path}`),
  };
}
