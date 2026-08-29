import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExerciseProgressPointDto } from '@pt/shared';
import { formatDate, formatWeight } from '@/lib/format';
import { AXIS_PROPS, CHART_INK, SERIES_ACCENT } from '../chart-theme';
import { ChartFrame, ChartTooltipBox } from './chart-frame';

/**
 * Estimated 1RM over time for one exercise — a single measure on a single axis. Load and
 * reps are deliberately *not* plotted together: two scales on one chart is the one
 * reliable way to make a progress chart lie.
 */
export function ExerciseChart({
  exerciseName,
  points,
  controls,
}: {
  exerciseName: string;
  points: ExerciseProgressPointDto[];
  controls: React.ReactNode;
}) {
  const data = points
    .filter((point) => point.estimated1rm != null)
    .map((point) => ({
      label: formatDate(point.doneAt).slice(0, 5),
      doneAt: point.doneAt,
      value: Math.round(point.estimated1rm!),
      reps: point.reps,
      loadKg: point.loadKg,
    }));

  return (
    <ChartFrame
      title="Evolução de carga"
      description={`1RM estimado em ${exerciseName}.`}
      controls={controls}
      table={
        <table className="w-full text-left text-xs">
          <thead className="text-text-subtle">
            <tr>
              <th className="py-1 pr-4 font-medium">Data</th>
              <th className="py-1 pr-4 font-medium">Série</th>
              <th className="py-1 font-medium">1RM estimado</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.doneAt}>
                <td className="py-1 pr-4">{formatDate(row.doneAt)}</td>
                <td className="py-1 pr-4">
                  {row.loadKg != null ? formatWeight(row.loadKg) : '—'} × {row.reps ?? '—'}
                </td>
                <td className="py-1">{formatWeight(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} unit=" kg" width={56} />
        <Tooltip
          cursor={{ stroke: CHART_INK.grid }}
          content={({ active, payload }) => {
            const row = active ? payload?.[0]?.payload : undefined;
            if (!row) return null;
            return (
              <ChartTooltipBox>
                <p className="font-medium">{formatDate(row.doneAt)}</p>
                <p style={{ color: CHART_INK.textMuted }}>
                  {row.loadKg != null ? formatWeight(row.loadKg) : '—'} × {row.reps ?? '—'} ·{' '}
                  {formatWeight(row.value)} est.
                </p>
              </ChartTooltipBox>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={SERIES_ACCENT}
          strokeWidth={2}
          dot={{ r: 4, fill: SERIES_ACCENT, stroke: CHART_INK.surfaceRaised, strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartFrame>
  );
}
