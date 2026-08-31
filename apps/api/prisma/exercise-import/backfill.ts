import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { mapExercise } from './map';
import { type FreeExerciseDbEntry } from './source-types';

/**
 * One-off backfill for exercises imported before name translation and image URLs
 * existed: `import.ts` skips slugs already present, so it never touches these rows.
 * Matches by slug (stable — derived from the untranslated English name) and updates
 * name/imageUrls only where they actually changed. Safe to re-run.
 */
async function main() {
  const prisma = new PrismaClient();
  const raw = readFileSync(join(__dirname, 'free-exercise-db.json'), 'utf-8');
  const entries = JSON.parse(raw) as FreeExerciseDbEntry[];

  let updated = 0;
  let unchanged = 0;
  let missing = 0;

  for (const entry of entries) {
    const mapped = mapExercise(entry);
    const existing = await prisma.exercise.findFirst({
      where: { tenantId: null, slug: mapped.slug },
      select: { id: true, name: true, imageUrls: true },
    });
    if (!existing) {
      missing += 1;
      continue;
    }
    const sameImages =
      existing.imageUrls.length === mapped.imageUrls.length &&
      existing.imageUrls.every((url, i) => url === mapped.imageUrls[i]);
    if (existing.name === mapped.name && sameImages) {
      unchanged += 1;
      continue;
    }
    await prisma.exercise.update({
      where: { id: existing.id },
      data: { name: mapped.name, imageUrls: mapped.imageUrls },
    });
    updated += 1;
  }

  console.log(`[backfill] updated=${updated} unchanged=${unchanged} missing=${missing}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
