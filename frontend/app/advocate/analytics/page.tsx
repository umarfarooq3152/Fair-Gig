'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { CommissionTrendsChart } from '@/components/advocate/commission-trends-chart';
import { IncomeZoneCategoryChart } from '@/components/advocate/income-zone-category-chart';
import { KpiCard } from '@/components/advocate/kpi-card';
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
  const [strictRetryCount, setStrictRetryCount] = useState(0);
  const MAX_STRICT_RETRIES = 5;

  const refresh = useCallback(async () => {
    setLoading(true);
    const payload = await loadAdvocateDashboard();
    setData(payload);
    setLoading(false);
  }, []);

  useEffect(() => {
    setMounted(true);
    void refresh();
  }, [refresh]);

  const allDataReady = Boolean(data?.summary) && (data?.errors.length ?? 0) === 0;
  const strictLoadingActive = loading || (!allDataReady && strictRetryCount < MAX_STRICT_RETRIES);

  useEffect(() => {
    if (loading || allDataReady || strictRetryCount >= MAX_STRICT_RETRIES) return;
    const retry = window.setTimeout(() => {
      setStrictRetryCount((prev) => prev + 1);
      void refresh();
    }, 1800);
    return () => window.clearTimeout(retry);
  }, [loading, allDataReady, strictRetryCount, refresh]);

  const s = data?.summary;

  return (
    <div className="min-h-screen space-y-8 bg-[#f1f5f9] pb-12 pt-2">
      {strictLoadingActive ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-white/35 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        </div>
      ) : null}

      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Labour advocate</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Advocate analytics panel</h1>
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
            <Bell className="h-4 w-4" />
            {(data?.grievanceInboxDelta ?? 0) > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {data!.grievanceInboxDelta > 99 ? '99+' : data!.grievanceInboxDelta}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </header>

      {strictLoadingActive ? (
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section id="commission-trends" className="scroll-mt-24 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-white">Platform commission rate trends</h2>
            <p className="text-sm text-slate-300">Weighted average deduction ÷ gross, by platform, last 6 months.</p>
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/90 p-2">
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
      </div>

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
    </div>
  );
}
