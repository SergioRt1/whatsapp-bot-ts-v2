export interface Favorability {
  buyerScore: number;
  sellerScore: number;
  percentile: number;  // [0..1]
  zscore: number;
  trend?: 'up' | 'down' | 'flat';
  buyerLabel: string;
  sellerLabel: string;
}

const LOOKBACK = parseInt(process.env.FX_LOOKBACK_SAMPLES ?? '180', 10);
const MOMENTUM_WEIGHT = parseFloat(process.env.FX_MOMENTUM_WEIGHT ?? '0');
const Z_MAX = parseFloat(process.env.FX_Z_MAX ?? '3.5'); // opcional

function mean(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1); }
function std(xs: number[], m: number) {
  const n = xs.length;
  if (n < 2) return 0;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
  return Math.sqrt(v);
}
function ema(series: number[], period: number): number {
  if (series.length === 0) return NaN;
  const k = 2 / (period + 1);
  let e = series[0];
  for (let i = 1; i < series.length; i++) e = series[i] * k + e * (1 - k);
  return e;
}
function clamp01(x: number) { return Math.min(1, Math.max(0, x)); }
function clampZ(z: number) { return Math.max(-Z_MAX, Math.min(Z_MAX, z)); }
function percentileRank(window: number[], value: number): number {
  const n = window.length;
  if (n === 0) return 0.5;
  let lt = 0, eq = 0;
  for (const v of window) {
    if (v < value) lt++;
    else if (v === value) eq++;
  }
  // (lt + 0.5*eq + 0.5) / (n + 1)
  return clamp01((lt + 0.5 * eq + 0.5) / (n + 1));
}

function label(score: number): string {
  if (score >= 70) return '💸';
  if (score >= 55) return '🙂';
  if (score > 45)  return '😐';
  if (score > 30)  return '😢';
  return '🤬';
}

export function scoreFavorability(series: number[]): Favorability {
  const window = series.slice(-LOOKBACK);
  const current = window.at(-1) ?? NaN; // get current
  const base = window.slice(0, -1);     // get series without current

  // Percentile: if there is no previous history, neutral (0.5)
  const p = base.length > 0 ? percentileRank(base, current) : 0.5;
  let buyer  = Math.round((1 - p) * 100);
  let seller = 100 - buyer;

  let tr: 'up' | 'down' | 'flat' = 'flat';
  if (MOMENTUM_WEIGHT > 0 && window.length >= 10) {
    const e7  = ema(window, 7);
    const e28 = ema(window, 28);
    if (e7 > e28 * 1.001) tr = 'up';
    else if (e7 < e28 * 0.999) tr = 'down';

    if (tr === 'up') {        // goes up => sell base more attractive
      seller = Math.min(100, Math.round(seller * (1 + MOMENTUM_WEIGHT)));
      buyer  = Math.max(0,   100 - seller);
    } else if (tr === 'down') {
      buyer  = Math.min(100, Math.round(buyer  * (1 + MOMENTUM_WEIGHT)));
      seller = Math.max(0,   100 - buyer);
    }
  }

  // Robust z-score: only if there is sufficient variance
  let z = 0;
  if (base.length >= 2) {
    const m = mean(base);
    const s = std(base, m);
    const EPS = Math.max(1e-9, Math.abs(m) * 1e-6); // relative scale
    if (s >= EPS) z = clampZ((current - m) / s);
  }

  return {
    buyerScore: buyer,
    sellerScore: seller,
    percentile: p,
    zscore: z,
    trend: tr,
    buyerLabel: label(buyer),
    sellerLabel: label(seller),
  };
}
