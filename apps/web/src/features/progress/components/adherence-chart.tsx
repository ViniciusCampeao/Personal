import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { AdherenceWeekDto } from '@pt/shared';
import { formatDate } from '@/lib/format';
import { AXIS_PROPS, CHART_INK, SERIES_ACCENT } from '../chart-theme';
import { ChartFrame, ChartTooltipBox } from './chart-frame';

/**
 * One series (percentage of prescribed sessions actually done), so no legend — the
 * title names it.
 */
export function AdherenceChart({ weeks }: { weeks: AdherenceWeekDto[] }) {
  const data = weeks.map((week) => ({
    label: formatDate(week.weekStart).slice(0, 5),
    pct: Math.round(week.adherenceRatio * 100),
    completed: week.completedSessions,
    expected: week.expectedSessions,
  }));

  return (
    <ChartFrame
      title="Aderência"
      description="Treinos concluídos sobre os prescritos, por semana."
      table={
        <table className="w-full text-left text-xs">
          <thead className="text-text-subtle">
            <tr>
              <th className="py-1 pr-4 font-medium">Semana</th>
              <th className="py-1 pr-4 font-medium">Concluídos</th>
              <th className="py-1 font-medium">Aderência</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.label}>
                <td className="py-1 pr-4">{row.label}</td>
                <td className="py-1 pr-4">
                  {row.completed}/{row.expected}
                </td>
                <td className="py-1">{row.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis domain={[0, 100]} unit="%" {...AXIS_PROPS} />
        <Tooltip
          cursor={{ fill: CHART_INK.surfaceRaised }}
          content={({ active, payload }) => {
            const row = active ? payload?.[0]?.payload : undefined;
            if (!row) return null;
            return (
              <ChartTooltipBox>
                <p className="font-medium">Semana de {row.label}</p>
                <p style={{ color: CHART_INK.textMuted }}>
                  {row.completed} de {row.expected} treinos · {row.pct}%
                </p>
              </ChartTooltipBox>
            );
          }}
        />
        <Bar dataKey="pct" fill={SERIES_ACCENT} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartFrame>
  );
}
