/**
 * Chart parameters, kept out of the components so every chart reads the same.
 *
 * The categorical order is fixed and never cycled: a series keeps its colour when a
 * filter removes its neighbours. These six steps were validated as a set against this
 * app's surface (#0b1220) — lightness band, chroma floor, adjacent CVD ΔE ≥ 8, normal
 * vision ΔE ≥ 15 and ≥ 3:1 contrast all pass. Adding a seventh hue is not allowed:
 * anything past the sixth series folds into "Outros".
 */
export const CATEGORICAL = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
] as const;

export const MAX_SERIES = CATEGORICAL.length - 1;

/** Single-series marks use the interface accent, not a categorical slot. */
export const SERIES_ACCENT = '#3987e5';

export const CHART_INK = {
  grid: '#1e2b45',
  axis: '#6f7d97',
  surface: '#0b1220',
  surfaceRaised: '#111c33',
  text: '#e8edf7',
  textMuted: '#a3b0c8',
};

export const AXIS_PROPS = {
  tick: { fill: CHART_INK.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;
