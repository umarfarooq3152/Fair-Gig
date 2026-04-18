'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CommissionTrendRow } from '@/features/advocate/types';
import { pivotCommissionTrends, platformColor } from '@/features/advocate/chart-helpers';

function usePlatformMeans(rows: CommissionTrendRow[]) {
  return useMemo(() => {
    const byPlat: Record<string, number[]> = {};
    for (const r of rows) {
      const p = r.platform;
      if (!byPlat[p]) byPlat[p] = [];
      byPlat[p].push(Number(r.avg_rate));
    }
    const means: Record<string, number> = {};
    for (const [p, vals] of Object.entries(byPlat)) {
      means[p] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return means;
  }, [rows]);
}

function CommissionTooltip({
  active,
  payload,
  label,
  platformMeans,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>;
  label?: string;
  platformMeans: Record<string, number>;
}) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => p.dataKey && p.value != null && p.dataKey !== 'month');
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-2 font-semibold text-slate-800">{label}</p>
      <ul className="space-y-1">
        {items.map((p) => {
          const key = String(p.dataKey);
          const v = Number(p.value);
          const mean = platformMeans[key];
          const spike = mean != null && !Number.isNaN(v) && v / 100 > mean * 1.12;
          return (
            <li key={key} className="flex justify-between gap-4">
              <span style={{ color: p.color }}>{key}</span>
              <span className="font-mono text-slate-700">{v.toFixed(1)}%</span>
              {spike ? (
                <span className="rounded bg-amber-100 px-1 text-[10px] font-bold uppercase text-amber-800">
                  Elevated
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CommissionTrendsChart(props: { data: CommissionTrendRow[]; mounted: boolean }) {
  const { data, mounted } = props;
  const chartData = useMemo(() => pivotCommissionTrends(data), [data]);
  const platformMeans = usePlatformMeans(data);
  const platforms = useMemo(() => {
    if (!chartData.length) return [];
    return Object.keys(chartData[0]).filter((k) => k !== 'month');
  }, [chartData]);

  if (!mounted) {
    return <div className="h-[320px] animate-pulse rounded-lg bg-slate-100" />;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="#64748b"
          tickFormatter={(v) => `${v}%`}
          domain={['auto', 'auto']}
        />
        <Tooltip content={<CommissionTooltip platformMeans={platformMeans} />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {platforms.map((p) => (
          <Line
            key={p}
            type="monotone"
            dataKey={p}
            stroke={platformColor(p)}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
