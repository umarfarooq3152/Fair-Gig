'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { IncomeZoneCategoryRow } from '@/features/advocate/types';
import {
  formatCategoryLabel,
  incomeChartCategories,
  pivotIncomeByZoneCategory,
  platformColor,
} from '@/features/advocate/chart-helpers';

const CATEGORY_BAR_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#a855f7', '#ec4899'];

export function IncomeZoneCategoryChart(props: { rows: IncomeZoneCategoryRow[]; mounted: boolean }) {
  const { rows, mounted } = props;
  const categories = useMemo(() => incomeChartCategories(rows), [rows]);
  const chartData = useMemo(() => pivotIncomeByZoneCategory(rows), [rows]);

  if (!mounted) {
    return <div className="h-[320px] animate-pulse rounded-lg bg-slate-100" />;
  }

  if (!chartData.length) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
        No shift income in the last 30 days for this breakdown.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="zone" tick={{ fontSize: 11 }} stroke="#64748b" />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="#64748b"
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
        />
        <Tooltip
          formatter={(value) => [`${Number(value ?? 0).toLocaleString()} PKR`, '']}
          labelFormatter={(z) => `Zone: ${z}`}
        />
        <Legend formatter={(value) => formatCategoryLabel(String(value))} wrapperStyle={{ fontSize: 12 }} />
        {categories.map((c, i) => (
          <Bar
            key={c}
            dataKey={c}
            name={c}
            fill={CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length] ?? platformColor('Other')}
            radius={[2, 2, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
