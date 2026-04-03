/**
 * Format a number as currency (no cents for large values).
 */
export function fmt(value: number | null | undefined, opts?: { decimals?: number; compact?: boolean }): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  const decimals = opts?.decimals ?? (Math.abs(value) >= 1000 ? 0 : 2);
  if (opts?.compact && Math.abs(value) >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(1) + "M";
  }
  if (opts?.compact && Math.abs(value) >= 10_000) {
    return "$" + (value / 1_000).toFixed(0) + "K";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format as percentage.
 */
export function pct(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  if (!isFinite(value)) return "∞";
  return value.toFixed(decimals) + "%";
}

/**
 * Format plain number.
 */
export function num(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Color class based on positive/negative.
 */
export function valueColor(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "text-sand-600";
}

/**
 * Background color class for metric cards.
 */
export function metricBg(value: number, thresholds?: { good: number; bad: number }): string {
  const g = thresholds?.good ?? 0;
  const b = thresholds?.bad ?? 0;
  if (value >= g) return "bg-profit/10 border-profit/20";
  if (value <= b) return "bg-loss/10 border-loss/20";
  return "bg-sand-100 border-sand-200";
}
