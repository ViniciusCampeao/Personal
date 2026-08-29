import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts';
import type { VolumeByMuscleDto } from '@pt/shared';
import { formatDate } from '@/lib/format';
import { MUSCLE_LABELS, labelOf } from '@/lib/labels';
import { AXIS_PROPS, CATEGORICAL, CHART_INK, MAX_SERIES } from '../chart-theme';
import { ChartFrame, ChartTooltipBox } from './chart-frame';

const OTHER = 'Outros';

interface WeekRow {
  label: string;
  [muscle: string]: string | number;
}

/**
 * Weekly training volume, split by muscle. The palette holds six slots, so the five
 * biggest muscles keep their own colour and everything else is summed into "Outros" —
 * a seventh generated hue would break the validated ordering.
 */
export function VolumeChart({ rows }: { rows: VolumeByMuscleDto[] }) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.muscle, (totals.get(row.muscle) ?? 0) + row.volumeKg);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([muscle]) => muscle);
  const named = ranked.slice(0, MAX_SERIES);
  const hasOther = ranked.length > named.length;

  const series = [
    ...named.map((muscle) => labelOf(MUSCLE_LABELS, muscle)),
    ...(hasOther ? [OTHER] : []),
  ];

  const byWeek = new Map<string, WeekRow>();
  for (const row of rows) {
    const key = row.weekStart;
    const week = byWeek.get(key) ?? { label: formatDate(key).slice(0, 5) };
    const name = named.includes(row.muscle) ? labelOf(MUSCLE_LABELS, row.muscle) : OTHER;
    week[name] = ((week[name] as number | undefined) ?? 0) + Math.round(row.volumeKg);
    byWeek.set(key, week);
  }
  const data = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, week]) => week);

  return (
    <ChartFrame
      title="Volume por músculo"
      description="Carga total levantada por semana, em quilos."
      table={
        <table className="w-full text-left text-xs">
          <thead className="text-text-subtle">
            <tr>
              <th className="py-1 pr-4 font-medium">Semana</th>
              {series.map((name) => (
                <th key={name} className="py-1 pr-4 font-medium">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((week) => (
              <tr key={String(week.label)}>
                <td className="py-1 pr-4">{week.label}</td>
                {series.map((name) => (
                  <td key={name} className="py-1 pr-4">
                    {(week[name] as number | undefined) ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} />
        <Tooltip
          cursor={{ fill: CHART_INK.surfaceRaised }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <ChartTooltipBox>
                <p className="font-medium">Semana de {String(label)}</p>
                {payload.map((entry) => (
                  <p key={String(entry.dataKey)} style={{ color: CHART_INK.textMuted }}>
                    {String(entry.dataKey)}: {Number(entry.value).toLocaleString('pt-BR')} kg
                  </p>
                ))}
              </ChartTooltipBox>
            );
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: CHART_INK.textMuted }}
          iconType="circle"
          iconSize={8}
        />
        {series.map((name, index) => (
          <Bar
            key={name}
            dataKey={name}
            stackId="volume"
            fill={CATEGORICAL[index]}
            // A 2px surface-coloured edge is the gap between stacked segments.
            stroke={CHART_INK.surfaceRaised}
            strokeWidth={2}
            maxBarSize={28}
            radius={index === series.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ChartFrame>
  );
}
