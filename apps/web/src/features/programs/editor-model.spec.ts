import {
  dayToEditor,
  editorToPayload,
  groupWithPrevious,
  newExercise,
  ungroup,
  type EditorExercise,
} from './editor-model';
import { summarizeEditorSets } from './summarize';

function exercise(overrides: Partial<EditorExercise> = {}): EditorExercise {
  return { ...newExercise('ex1', 'Supino'), ...overrides };
}

describe('editorToPayload', () => {
  it('recomputes orderIndex, setNumber and groupOrder from list position', () => {
    const groupKey = 'block-1';
    const payload = editorToPayload([
      exercise({ groupKey }),
      exercise({ exerciseId: 'ex2', groupKey }),
      exercise({ exerciseId: 'ex3' }),
    ]);

    expect(payload.map((p) => p.orderIndex)).toEqual([0, 1, 2]);
    expect(payload[0]).toMatchObject({ groupKey, groupOrder: 0 });
    expect(payload[1]).toMatchObject({ groupKey, groupOrder: 1 });
    expect(payload[2]!.groupKey).toBeUndefined();
    expect(payload[0]!.sets[0]!.setNumber).toBe(1);
  });

  it('drops blank optional fields instead of sending empty strings', () => {
    const payload = editorToPayload([exercise()]);
    const set = payload[0]!.sets[0]!;
    expect('repsMin' in set).toBe(false);
    expect('targetLoadKg' in set).toBe(false);
    expect('restSeconds' in payload[0]!).toBe(false);
    expect('tempo' in payload[0]!).toBe(false);
  });

  it('parses decimal comma the way a Brazilian keyboard types it', () => {
    const base = exercise();
    const payload = editorToPayload([
      { ...base, sets: [{ ...base.sets[0]!, targetLoadKg: '22,5', repsMin: '8' }] },
    ]);
    expect(payload[0]!.sets[0]).toMatchObject({ targetLoadKg: 22.5, repsMin: 8 });
  });
});

describe('grouping', () => {
  it('groupWithPrevious shares one key across the block', () => {
    const next = groupWithPrevious([exercise(), exercise({ exerciseId: 'ex2' })], 1);
    expect(next[0]!.groupKey).not.toBeNull();
    expect(next[1]!.groupKey).toBe(next[0]!.groupKey);
  });

  it('ungroup dissolves a block left with a single member', () => {
    const grouped = groupWithPrevious([exercise(), exercise({ exerciseId: 'ex2' })], 1);
    const next = ungroup(grouped, 1);
    expect(next.every((e) => e.groupKey === null)).toBe(true);
  });

  it('ungroup keeps a block that still has two members', () => {
    let list = groupWithPrevious(
      [exercise(), exercise({ exerciseId: 'ex2' }), exercise({ exerciseId: 'ex3' })],
      1,
    );
    list = list.map((e, i) => (i === 2 ? { ...e, groupKey: list[0]!.groupKey } : e));
    const next = ungroup(list, 2);
    expect(next[2]!.groupKey).toBeNull();
    expect(next[0]!.groupKey).not.toBeNull();
    expect(next[1]!.groupKey).toBe(next[0]!.groupKey);
  });
});

describe('dayToEditor', () => {
  it('orders exercises and sets by the server indexes and stringifies numbers', () => {
    const editor = dayToEditor({
      id: 'd1',
      label: 'A',
      name: null,
      orderIndex: 0,
      exercises: [
        {
          id: 'pe2',
          orderIndex: 1,
          technique: 'NORMAL',
          groupKey: null,
          groupOrder: null,
          restSeconds: null,
          tempo: null,
          notes: null,
          exercise: { id: 'ex2', name: 'Remada' },
          sets: [],
        },
        {
          id: 'pe1',
          orderIndex: 0,
          technique: 'NORMAL',
          groupKey: null,
          groupOrder: null,
          restSeconds: 90,
          tempo: null,
          notes: null,
          exercise: { id: 'ex1', name: 'Supino' },
          sets: [
            {
              id: 's2',
              setNumber: 2,
              setType: 'WORK',
              repsMin: 8,
              repsMax: 10,
              targetLoadKg: 60,
              targetRir: 2,
              restSecondsOverride: null,
            },
            {
              id: 's1',
              setNumber: 1,
              setType: 'WARMUP',
              repsMin: 12,
              repsMax: null,
              targetLoadKg: null,
              targetRir: null,
              restSecondsOverride: null,
            },
          ],
        },
      ],
    } as never);

    expect(editor.map((e) => e.exerciseName)).toEqual(['Supino', 'Remada']);
    expect(editor[0]!.restSeconds).toBe('90');
    expect(editor[0]!.sets.map((s) => s.setType)).toEqual(['WARMUP', 'WORK']);
    expect(editor[0]!.sets[1]).toMatchObject({ repsMin: '8', targetLoadKg: '60' });
  });
});

describe('summarizeEditorSets', () => {
  it('summarizes counting all sets but ranging on the first work set', () => {
    const base = exercise().sets[0]!;
    expect(
      summarizeEditorSets([
        { ...base, setType: 'WARMUP', repsMin: '12', repsMax: '12' },
        { ...base, repsMin: '8', repsMax: '10' },
        { ...base, repsMin: '8', repsMax: '10' },
      ]),
    ).toBe('3 × 8–10');
    expect(summarizeEditorSets([])).toBe('Sem séries');
    expect(summarizeEditorSets([{ ...base, repsMin: '10', repsMax: '10' }])).toBe('1 × 10');
  });
});
