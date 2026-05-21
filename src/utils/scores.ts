const SCORE_MAX = 5;

export function clampScore(value?: number | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(SCORE_MAX, Math.max(0, numeric));
}

export function scoreToPercent(value?: number | null) {
  return Math.round((clampScore(value) / SCORE_MAX) * 100);
}

export function averageScorePercent(values: (number | null | undefined)[]) {
  const valid = values.map(clampScore).filter((value) => value > 0);
  if (!valid.length) return null;
  const average = valid.reduce((total, value) => total + value, 0) / valid.length;
  return scoreToPercent(average);
}

export function formatPercent(value?: number | null) {
  return typeof value === 'number' ? `${value}%` : '-';
}
