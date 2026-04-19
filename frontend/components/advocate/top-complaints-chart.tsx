'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TopComplaintRow } from '@/features/advocate/types';
import { formatCategoryLabel } from '@/features/advocate/chart-helpers';

export function TopComplaintsChart(props: { data: TopComplaintRow[]; mounted: boolean }) {
  const { data, mounted } = props;
  const chartData = data.map((r) => ({
    ...r,
    label: formatCategoryLabel(r.category),
  }));

  if (!mounted) {
    return <div className="h-[280px] animate-pulse rounded-lg bg-slate-100" />;
  }

  if (!chartData.length) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
        No complaints filed in the last 7 days.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={148}
          tick={{ fontSize: 11 }}
          stroke="#64748b"
        />
        <Tooltip formatter={(v) => [Number(v ?? 0), 'Reports']} />
        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
