export function normalizeCapRate(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  if (value < 1) return value * 100;
  return value;
}

export function normalizeMarketValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= -1000000) return null;
  return value;
}

export function normalizeRentToIncomeRatio(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  if (value > 1000) return value / 1000;
  if (value > 100) return value / 100;
  return value;
}
