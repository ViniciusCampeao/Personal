import type { ReactElement, ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { CHART_INK } from '../chart-theme';

interface ChartFrameProps {
  title: string;
  description?: string;
  /** Rendered above the chart, on one row — filters belong here, not inside the plot. */
  controls?: ReactNode;
  /** Same numbers the chart draws, for screen readers and for anyone who wants exact values. */
  table: ReactNode;
  height?: number;
  children: ReactElement;
}

export function ChartFrame({
  title,
  description,
  controls,
  table,
  height = 220,
  children,
}: ChartFrameProps) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-text-muted">{description}</p> : null}
      </header>

      {controls ? <div className="flex flex-wrap items-center gap-2">{controls}</div> : null}

      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>

      {/* The chart is decorative to assistive tech; this carries the actual data. */}
      <details className="text-sm">
        <summary className="cursor-pointer text-text-subtle">Ver dados</summary>
        <div className="mt-2 overflow-x-auto">{table}</div>
      </details>
    </section>
  );
}

export function ChartTooltipBox({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-field border border-border px-3 py-2 text-xs shadow-lg"
      style={{ background: CHART_INK.surface, color: CHART_INK.text }}
    >
      {children}
    </div>
  );
}
