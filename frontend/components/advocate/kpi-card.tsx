'use client';

import type { ReactNode } from 'react';

type Trend = 'up' | 'down' | 'neutral';

const trendIcon: Record<Trend, string> = {
  up: '↑',
  down: '↓',
  neutral: '→',
};

export function KpiCard(props: {
  title: string;
  value: string;
  sub?: ReactNode;
  trend?: Trend;
  trendLabel?: string;
  emphasis?: 'default' | 'danger' | 'warning';
}) {
  const { title, value, sub, trend, trendLabel, emphasis = 'default' } = props;
  const trendCls =
    emphasis === 'danger'
      ? 'text-red-600'
      : emphasis === 'warning'
        ? 'text-amber-700'
        : trend === 'down'
          ? 'text-red-600'
          : trend === 'up'
            ? 'text-emerald-600'
            : 'text-slate-500';

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-sm text-slate-600">{sub}</p> : null}
      {trendLabel ? (
        <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${trendCls}`}>
          {trend ? <span aria-hidden>{trendIcon[trend]}</span> : null}
          {trendLabel}
        </p>
      ) : null}
    </div>
  );
}
