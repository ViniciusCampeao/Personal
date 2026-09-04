import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type PrismaClient } from '@prisma/client';
import { CATALOG } from './catalog';
import { mapExercise } from './map';
import { type FreeExerciseDbEntry } from './source-types';

/**
 * Idempotent import of the curated slice of the vendored Free Exercise DB (Unlicense) as
 * global exercises (`tenantId: null`). Safe to re-run: only slugs missing from the
 * current global set are inserted. No network access at runtime — the dataset is
 * committed alongside this file (M2 plan §"dataset vendorizado").
 *
 * The dataset's other ~560 entries are deliberately left out; see `catalog.ts`.
 */
export async function importFreeExerciseDb(prisma: PrismaClient): Promise<void> {
  const raw = readFileSync(join(__dirname, 'free-exercise-db.json'), 'utf-8');
  const entries = JSON.parse(raw) as FreeExerciseDbEntry[];

  const existing = await prisma.exercise.findMany({
    where: { tenantId: null },
    select: { slug: true },
  });
  const existingSlugs = new Set(existing.map((e) => e.slug));

  const seenInThisRun = new Set<string>();
  const toImport = entries
    .map(mapExercise)
    .filter((exercise) => exercise !== null)
    .filter((exercise) => {
      if (existingSlugs.has(exercise.slug) || seenInThisRun.has(exercise.slug)) return false;
      seenInThisRun.add(exercise.slug);
      return true;
    });

  // A catalog key that matches no source entry would silently shrink the library, so say
  // so loudly. `catalog.spec.ts` already fails CI on this; the log is for a manual seed
  // run against a hand-edited dataset.
  const matched = entries.filter((entry) => CATALOG[entry.name]).length;
  if (matched !== Object.keys(CATALOG).length) {
    console.warn(
      `[seed] ${Object.keys(CATALOG).length - matched} catalog entries matched no source entry.`,
    );
  }

  if (toImport.length === 0) {
    console.log('[seed] exercise library already imported, nothing to do.');
    return;
  }

  const coverage = new Map<string, number>();
  let failures = 0;

  for (const exercise of toImport) {
    coverage.set(exercise.movementPattern, (coverage.get(exercise.movementPattern) ?? 0) + 1);
    try {
      await prisma.exercise.create({
        data: {
          tenantId: null,
          name: exercise.name,
          slug: exercise.slug,
          instructions: exercise.instructions,
          cues: [],
          commonMistakes: [],
          movementPattern: exercise.movementPattern,
          equipment: exercise.equipment,
          loadType: exercise.loadType,
          unilateral: exercise.unilateral,
          isActive: true,
          imageUrls: exercise.imageUrls,
          muscles: { createMany: { data: exercise.muscles } },
        },
      });
    } catch (error) {
      failures += 1;
      console.error(`[seed] failed to import "${exercise.name}" (${exercise.slug}):`, error);
    }
  }

  console.log(
    `[seed] imported ${toImport.length - failures}/${toImport.length} global exercises` +
      (failures > 0 ? ` (${failures} failed, see above)` : '') +
      '.',
  );
  console.log('[seed] movementPattern coverage:', Object.fromEntries(coverage));
}
