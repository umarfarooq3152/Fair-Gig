'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CommissionTrendsChart } from '@/components/advocate/commission-trends-chart';
import { IncomeZoneCategoryChart } from '@/components/advocate/income-zone-category-chart';
import { KpiCard } from '@/components/advocate/kpi-card';
import { TagClusterBubbles } from '@/components/advocate/tag-cluster-bubbles';
import { TopComplaintsChart } from '@/components/advocate/top-complaints-chart';
import { VulnerabilityTable } from '@/components/advocate/vulnerability-table';
import { loadAdvocateDashboard } from '@/features/advocate/fetch-dashboard';
import type { AdvocateDashboardPayload } from '@/features/advocate/types';

function formatMonthYear(d: Date) {
  return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

export default function AdvocateAnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdvocateDashboardPayload | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const payload = await loadAdvocateDashboard();
    setData(payload);
    setLoading(false);
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

  const exportReport = () => {
    if (!data?.summary) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            summary: data.summary,
            note: 'Commission and income series omitted from export for size; re-fetch from analytics service as needed.',
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fairgig-advocate-summary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = data?.summary;

  return (
    <div className="min-h-screen space-y-8 bg-[#f1f5f9] pb-12 pt-2">
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Labour advocate</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Advocate analytics panel</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live signals from analytics (8005) and grievance board (8004). Refreshed on load.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <span className="text-slate-500">Period focus · </span>
            <span className="font-semibold">{formatMonthYear(new Date())}</span>
          </div>
          <Link
            href="/advocate/grievances"
            className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50"
            aria-label="Grievance inbox"
          >
            <span className="text-lg">🔔</span>
            {(data?.grievanceInboxDelta ?? 0) > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {data!.grievanceInboxDelta > 99 ? '99+' : data!.grievanceInboxDelta}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={exportReport}
            disabled={!s}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export summary
          </button>
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </header>

      {data?.errors.length ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          <p className="font-semibold">Partial data</p>
          <ul className="mt-1 list-inside list-disc">
            {data.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200/80" />
          ))}
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total registered workers"
            value={s ? s.total_workers.toLocaleString() : '—'}
            trend={s && s.registration_mom_pct >= 0 ? 'up' : 'down'}
            trendLabel={
              s
                ? `${s.registration_mom_pct >= 0 ? '+' : ''}${s.registration_mom_pct}% new registrations vs last month`
                : undefined
            }
            emphasis="default"
          />
          <KpiCard
            title="Avg platform commission"
            value={s ? `${s.avg_commission_rate.toFixed(1)}%` : '—'}
            trend={s && s.commission_mom_delta_pp > 0 ? 'up' : s && s.commission_mom_delta_pp < 0 ? 'down' : 'neutral'}
            trendLabel={
              s
                ? `${s.commission_mom_delta_pp >= 0 ? '+' : ''}${s.commission_mom_delta_pp.toFixed(1)} pp vs prior month (weighted)`
                : undefined
            }
            emphasis={s && s.commission_mom_delta_pp > 0 ? 'danger' : 'default'}
          />
          <KpiCard
            title="Active grievances"
            value={s ? s.active_complaints.toLocaleString() : '—'}
            sub={
              s ? (
                <span className="text-amber-800">
                  {s.escalated_complaints} escalated —{' '}
                  <Link href="/advocate/grievances" className="font-medium underline">
                    open queue
                  </Link>
                </span>
              ) : null
            }
            emphasis="warning"
          />
          <KpiCard
            title="Vulnerability flags"
            value={s ? s.vulnerability_count.toLocaleString() : '—'}
            sub="Income dropped more than 20% vs previous month"
            trend={s && s.vulnerability_count > 0 ? 'down' : 'neutral'}
            trendLabel={s && s.vulnerability_count > 0 ? 'Review workers at risk below' : 'No flagged workers'}
            emphasis={s && s.vulnerability_count > 0 ? 'danger' : 'default'}
          />
        </section>
      )}

      <section id="commission-trends" className="scroll-mt-24 space-y-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Platform commission rate trends</h2>
          <p className="text-sm text-slate-600">Weighted average deduction ÷ gross, by platform, last 6 months.</p>
          <div className="mt-4">
            <CommissionTrendsChart data={data?.commission ?? []} mounted={mounted} />
          </div>
        </div>
      </section>

      <section id="income-zones" className="scroll-mt-24 space-y-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Income by city zone &amp; category</h2>
          <p className="text-sm text-slate-600">Sum of net received (PKR) over the last 30 days from live shifts.</p>
          <div className="mt-4">
            <IncomeZoneCategoryChart rows={data?.incomeByZoneCategory ?? []} mounted={mounted} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section id="vulnerability" className="scroll-mt-24 space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Workers at risk</h2>
            <p className="text-sm text-slate-600">Month-on-month net income drop beyond the 20% threshold.</p>
            <div className="mt-4">
              <VulnerabilityTable rows={data?.vulnerability ?? []} />
            </div>
          </div>
        </section>

        <section id="top-complaints" className="scroll-mt-24 space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Top complaint categories</h2>
            <p className="text-sm text-slate-600">Volume in the last 7 days from grievance.complaints.</p>
            <div className="mt-4">
              <TopComplaintsChart data={data?.topComplaints ?? []} mounted={mounted} />
            </div>
          </div>
        </section>
      </div>

      <section id="grievance-clusters" className="scroll-mt-24 space-y-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Grievance clusters</h2>
          <p className="text-sm text-slate-600">
            Primary tag × platform from <code className="rounded bg-slate-100 px-1">GET /api/complaints/board/tag-clusters</code>.
          </p>
          <div className="mt-4">
            <TagClusterBubbles rows={data?.tagClusters ?? []} />
          </div>
        </div>
      </section>
    </div>
  );
}
