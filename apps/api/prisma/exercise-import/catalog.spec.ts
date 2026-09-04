import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG } from './catalog';
import { type FreeExerciseDbEntry } from './source-types';

/**
 * The catalog is keyed by the source's English name, typed by hand. A typo there would
 * not throw — the exercise would simply never be imported, and nobody would notice a
 * library that is one row short. These two checks are what make that key safe to hand-edit.
 */
describe('CATALOG', () => {
  const entries = JSON.parse(
    readFileSync(join(__dirname, 'free-exercise-db.json'), 'utf-8'),
  ) as FreeExerciseDbEntry[];
  const sourceNames = new Set(entries.map((entry) => entry.name));

  it('only references exercises that exist in the vendored dataset', () => {
    const unknown = Object.keys(CATALOG).filter((name) => !sourceNames.has(name));
    expect(unknown).toEqual([]);
  });

  it('gives every exercise a distinct Portuguese name', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const [source, curated] of Object.entries(CATALOG)) {
      const previous = seen.get(curated.name);
      if (previous) collisions.push(`${curated.name}: ${previous} / ${source}`);
      else seen.set(curated.name, source);
    }
    expect(collisions).toEqual([]);
  });

  it('never leaves an English word in a Portuguese name by accident', () => {
    // Bare-word leftovers from the old token translator. Loanwords a Brazilian trainer
    // actually says out loud (supino, leg press, drop set, crossover…) are deliberate and
    // listed here as allowed rather than banned wholesale.
    const LEAKED = /\b(leg|arm|back|chest|grip|press|curl|raise|stretch|machine|barbell)\b/i;
    const ALLOWED = new Set([
      'Leg Press',
      'Leg Press com Base Fechada',
      'Pallof Press',
      'Pallof Press com Rotação',
      'JM Press',
      'Push Press',
      'Panturrilha no Leg Press',
      'Desenvolvimento com Impulso (Push Press)',
    ]);
    const leaked = Object.values(CATALOG)
      .map((curated) => curated.name)
      .filter((name) => LEAKED.test(name) && !ALLOWED.has(name));
    expect(leaked).toEqual([]);
  });
});
