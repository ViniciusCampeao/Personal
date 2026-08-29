import type { EditorSet } from './editor-model';

/** "4 × 8–10" from the editor's string-typed cells. */
export function summarizeEditorSets(sets: EditorSet[]): string {
  if (sets.length === 0) return 'Sem séries';
  const reference = sets.find((set) => set.setType !== 'WARMUP') ?? sets[0]!;
  const min = reference.repsMin.trim();
  const max = reference.repsMax.trim();
  const range = min && max && min !== max ? `${min}–${max}` : max || min;
  return range ? `${sets.length} × ${range}` : `${sets.length} séries`;
}
