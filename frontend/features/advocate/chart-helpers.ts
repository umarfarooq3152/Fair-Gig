import type { CommissionTrendRow, IncomeZoneCategoryRow } from './types';

export const PLATFORM_CHART_COLORS: Record<string, string> = {
  Careem: '#2563eb',
  Bykea: '#10b981',
  foodpanda: '#ea580c',
  Upwork: '#7c3aed',
  Other: '#64748b',
};

export function platformColor(platform: string): string {
  return PLATFORM_CHART_COLORS[platform] ?? PLATFORM_CHART_COLORS.Other;
}

export function formatCategoryLabel(slug: string): string {
  const map: Record<string, string> = {
    ride_hailing: 'Ride-hailing',
    food_delivery: 'Food delivery',
    freelance: 'Freelance',
    domestic: 'Domestic',
  };
  return map[slug] ?? slug.replace(/_/g, ' ');
}

/** Recharts-friendly rows: one object per month, each platform a percentage (0–100). */
export function pivotCommissionTrends(rows: CommissionTrendRow[]): Record<string, string | number | null>[] {
  if (!rows.length) return [];
  const months = [...new Set(rows.map((r) => r.month))].sort();
  const platforms = [...new Set(rows.map((r) => r.platform))].sort();
  return months.map((month) => {
    const point: Record<string, string | number | null> = { month };
    for (const p of platforms) {
      const hit = rows.find((r) => r.month === month && r.platform === p);
      point[p] = hit != null ? Math.round(Number(hit.avg_rate) * 10000) / 100 : null;
    }
    return point;
  });
}

export function pivotIncomeByZoneCategory(rows: IncomeZoneCategoryRow[]): Record<string, string | number>[] {
  if (!rows.length) return [];
  const zones = [...new Set(rows.map((r) => r.zone))].sort();
  const categories = [...new Set(rows.map((r) => r.category))].sort();
  const grid = new Map<string, Map<string, number>>();
  for (const z of zones) {
    grid.set(z, new Map(categories.map((c) => [c, 0])));
  }
  for (const r of rows) {
    const m = grid.get(r.zone);
    if (m) m.set(r.category, Number(r.total_net));
  }
  return zones.map((zone) => {
    const m = grid.get(zone)!;
    const row: Record<string, string | number> = { zone };
    for (const c of categories) {
      row[c] = m.get(c) ?? 0;
    }
    return row;
  });
}

export function incomeChartCategories(rows: IncomeZoneCategoryRow[]): string[] {
  return [...new Set(rows.map((r) => r.category))].sort();
}
