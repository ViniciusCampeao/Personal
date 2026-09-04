/**
 * Chart parameters, kept out of the components so every chart reads the same.
 *
 * The categorical order is fixed and never cycled: a series keeps its colour when a
 * filter removes its neighbours. These six steps were validated as a set against this
 * app's surface (#050506) — lightness band, chroma floor, adjacent CVD ΔE ≥ 8 (worst
 * pair 12.3, deutan), normal vision ΔE ≥ 15 (worst 22.3) and ≥ 3:1 contrast all pass.
 * Adding a seventh hue is not allowed: anything past the sixth series folds into "Outros".
 *
 * Re-validate with the palette validator before touching a value — and note that the
 * *order* is load-bearing, not just the hexes: the orange next to the gold collapses to
 * ΔE 0.8 under deuteranopia, which is exactly why they sit at opposite ends of the list.
 * Orange leads because the single-series accent is orange, and the brand is orange; the
 * blue lead this replaced was what made every chart read as generic.
 */
export const CATEGORICAL = [
  '#dc7100',
  '#5083e3',
  '#00ac7d',
  '#a964c8',
  '#ab9100',
  '#d45180',
] as const;

export const MAX_SERIES = CATEGORICAL.length - 1;

/** Single-series marks use the interface accent, not a categorical slot. */
export const SERIES_ACCENT = '#ff8a1f';

/** Mirrors the interface tokens in src/index.css — keep the two in sync. */
export const CHART_INK = {
  grid: '#1f1f23',
  axis: '#737380',
  surface: '#050506',
  surfaceRaised: '#101013',
  text: '#f4f4f5',
  textMuted: '#a3a3ac',
};

export const AXIS_PROPS = {
  tick: { fill: CHART_INK.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;
