import { SET_TYPE_LABELS } from '@/lib/labels';
import { emptySet, type EditorSet } from '../editor-model';

interface SetGridProps {
  sets: EditorSet[];
  onChange: (sets: EditorSet[]) => void;
}

const SET_TYPES = ['WARMUP', 'WORK', 'BACKOFF', 'DROP', 'FAILURE'] as const;

/**
 * Spreadsheet-shaped on purpose (spec §8): a trainer fills a program column by column,
 * and every cell is a plain input so tabbing through the whole day works.
 */
export function SetGrid({ sets, onChange }: SetGridProps) {
  function patch(index: number, changes: Partial<EditorSet>) {
    onChange(sets.map((set, i) => (i === index ? { ...set, ...changes } : set)));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="text-xs uppercase tracking-wide text-text-subtle">
          <tr>
            <th className="w-8 pb-1 text-left font-medium">#</th>
            <th className="pb-1 text-left font-medium">Tipo</th>
            <th className="pb-1 text-left font-medium">Reps</th>
            <th className="pb-1 text-left font-medium">Carga</th>
            <th className="pb-1 text-left font-medium">RIR</th>
            <th className="pb-1 text-left font-medium">Descanso</th>
            <th className="w-10 pb-1" />
          </tr>
        </thead>
        <tbody>
          {sets.map((set, index) => (
            <tr key={set.key}>
              <td className="py-1 pr-2 text-text-subtle">{index + 1}</td>
              <td className="py-1 pr-2">
                <select
                  aria-label={`Tipo da série ${index + 1}`}
                  value={set.setType}
                  onChange={(event) =>
                    patch(index, { setType: event.target.value as EditorSet['setType'] })
                  }
                  className="h-10 w-full rounded-lg border border-border bg-surface-sunken px-2 text-sm text-text"
                >
                  {SET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SET_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1 pr-2">
                <div className="flex items-center gap-1">
                  <Cell
                    label={`Reps mínimas da série ${index + 1}`}
                    value={set.repsMin}
                    onChange={(value) => patch(index, { repsMin: value })}
                  />
                  <span className="text-text-subtle">–</span>
                  <Cell
                    label={`Reps máximas da série ${index + 1}`}
                    value={set.repsMax}
                    onChange={(value) => patch(index, { repsMax: value })}
                  />
                </div>
              </td>
              <td className="py-1 pr-2">
                <Cell
                  label={`Carga da série ${index + 1}`}
                  value={set.targetLoadKg}
                  onChange={(value) => patch(index, { targetLoadKg: value })}
                />
              </td>
              <td className="py-1 pr-2">
                <Cell
                  label={`RIR da série ${index + 1}`}
                  value={set.targetRir}
                  onChange={(value) => patch(index, { targetRir: value })}
                />
              </td>
              <td className="py-1 pr-2">
                <Cell
                  label={`Descanso da série ${index + 1}`}
                  value={set.restSecondsOverride}
                  onChange={(value) => patch(index, { restSecondsOverride: value })}
                />
              </td>
              <td className="py-1">
                <button
                  type="button"
                  aria-label={`Remover série ${index + 1}`}
                  disabled={sets.length === 1}
                  onClick={() => onChange(sets.filter((_, i) => i !== index))}
                  className="size-8 rounded text-text-subtle hover:text-danger disabled:opacity-30"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() => onChange([...sets, emptySet(sets[sets.length - 1])])}
        className="mt-2 text-sm text-accent underline"
      >
        + Série
      </button>
    </div>
  );
}

function Cell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputMode="decimal"
      className="h-10 w-16 rounded-lg border border-border bg-surface-sunken px-2 text-center text-sm text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent"
    />
  );
}
