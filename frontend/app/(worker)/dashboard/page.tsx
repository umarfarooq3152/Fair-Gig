'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { EChartsOption } from 'echarts';
import { Award, Download, FileText } from 'lucide-react';
import { API_BASE, authFetch } from '@/lib/api';

const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-slate-100" />,
});

type Shift = {
  id: string;
  platform: string;
  shift_date: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  verification_status?: string;
};

type AnomalyItem = {
  type: string;
  severity: string;
  affected_date: string;
  platform?: string;
  explanation?: string;
};

type Complaint = {
  id: string;
  worker_id: string;
  platform: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
};

type ChartPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
type BucketUnit = 'day' | 'week' | 'month' | 'year';

function asDate(dateLike: string) {
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatShortDate(d: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(d);
}

function formatDateLong(dateLike: string) {
  const d = asDate(dateLike);
  if (!d) return dateLike;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(d);
}

function cutoffForPeriod(period: ChartPeriod) {
  const now = new Date();
  const cutoff = new Date(now);
  if (period === 'daily') cutoff.setDate(cutoff.getDate() - 14);
  if (period === 'weekly') cutoff.setDate(cutoff.getDate() - 84);
  if (period === 'monthly') cutoff.setMonth(cutoff.getMonth() - 12);
  if (period === 'yearly') cutoff.setFullYear(cutoff.getFullYear() - 5);
  return { now, cutoff };
}

function bucketUnitFromPeriod(period: ChartPeriod): BucketUnit {
  if (period === 'daily') return 'day';
  if (period === 'weekly') return 'week';
  if (period === 'monthly') return 'month';
  return 'year';
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function bucketKeyForDate(date: Date, unit: BucketUnit) {
  if (unit === 'day') {
    return date.toISOString().slice(0, 10);
  }
  if (unit === 'week') {
    return getWeekStart(date).toISOString().slice(0, 10);
  }
  if (unit === 'month') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  return String(date.getFullYear());
}

function bucketLabelFromKey(key: string, unit: BucketUnit) {
  if (unit === 'day') {
    const d = asDate(`${key}T00:00:00`);
    return d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(d) : key;
  }
  if (unit === 'week') {
    const d = asDate(`${key}T00:00:00`);
    if (!d) return key;
    return `Wk ${new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(d)}`;
  }
  if (unit === 'month') {
    const d = asDate(`${key}-01T00:00:00`);
    return d ? new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(d) : key;
  }
  return key;
}

function filterShiftsByPeriod(input: Shift[], period: ChartPeriod) {
  const { now, cutoff } = cutoffForPeriod(period);
  return input.filter((s) => {
    const d = asDate(s.shift_date);
    if (!d) return false;
    return d >= cutoff && d <= now;
  });
}

function PeriodSelect({ value, onChange, dark = false }: { value: ChartPeriod; onChange: (next: ChartPeriod) => void; dark?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ChartPeriod)}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none transition ${dark
        ? 'border-slate-700 bg-slate-900 text-slate-200 focus:border-slate-500'
        : 'border-slate-200 bg-white text-slate-700 focus:border-sky-300'
        }`}
    >
      <option value="daily">Daily</option>
      <option value="weekly">Weekly</option>
      <option value="monthly">Monthly</option>
      <option value="yearly">Yearly</option>
    </select>
  );
}

function AnomalyCard({ anomaly }: { anomaly: AnomalyItem }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!anomaly.platform || !anomaly.affected_date) return;
    const month = anomaly.affected_date.slice(0, 7);
    fetch(`${API_BASE.analytics}/analytics/collective-count?platform=${encodeURIComponent(anomaly.platform)}&anomaly_type=${encodeURIComponent(anomaly.type)}&month=${month}`)
      .then(r => r.json())
      .then(d => setCount(d.count))
      .catch(() => setCount(0));
  }, [anomaly]);

  const severityColor = anomaly.severity === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' : anomaly.severity === 'medium' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-white capitalize">{String(anomaly.type).replace(/_/g, ' ')}</p>
          <p className="text-xs text-slate-400">{formatDateLong(anomaly.affected_date)} • {anomaly.platform}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${severityColor}`}>
          {anomaly.severity}
        </span>
      </div>
      <p className="text-sm text-slate-300">{anomaly.explanation}</p>

      <div className="mt-1 flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
        </span>
        <p className="text-xs text-slate-400">
          {count === null ? 'Checking collective data...' : (count > 1 ? `You are not alone — ${count - 1} other workers reported the same issue on ${anomaly.platform} this month.` : `You're the first to flag this unique pattern on ${anomaly.platform} this month.`)}
        </p>
      </div>
    </div>
  );
}

function AnomalyReportPanel({ anomalies, onRun, isAnalyzing, riskScore }: { anomalies: AnomalyItem[], onRun: () => void, isAnalyzing: boolean, riskScore: number }) {
  const badgeColor = riskScore >= 70 ? 'bg-red-500 text-white' : riskScore >= 40 ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white';

  return (
    <div className="col-span-12 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl shadow-slate-900/20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-white">Anomaly Report</h2>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${badgeColor}`}>
            Risk Score: {riskScore}
          </span>
        </div>
        <button
          onClick={onRun}
          disabled={isAnalyzing}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow shadow-sky-600/20 transition hover:bg-sky-500 disabled:opacity-50"
        >
          {isAnalyzing ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          )}
          {isAnalyzing ? 'Analyzing...' : 'Run Anomaly Analysis'}
        </button>
      </div>

      {anomalies.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {anomalies.map((a, idx) => <AnomalyCard key={idx} anomaly={a} />)}

          {anomalies.length === 1 && (
            <div className="col-span-1 flex flex-col justify-center rounded-xl border border-slate-700/50 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-900/40 via-slate-800 to-slate-800 p-6 lg:col-span-2">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-500/20">
                  <svg className="h-6 w-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Continuous Monitoring Active</h3>
                  <p className="mt-1 text-sm text-slate-300">FairGig's K-Anonymity engine has successfully processed your last 90 days of ledger entries securely.</p>
                  <p className="mt-1 text-xs text-slate-400">This isolated anomaly was identified using boundary checks and heavily cross-referenced with your city zone median.</p>
                </div>
              </div>
            </div>
          )}
          {anomalies.length === 2 && (
            <div className="col-span-1 flex items-center justify-center rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 text-center">
              <p className="text-xs font-semibold text-slate-400">Monitoring complete for 90-day period.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-400">No anomalies detected</h3>
            <p className="text-xs text-slate-300">Your earnings look consistent across all platforms over the selected period. Operations normal.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkerDashboardPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [performancePeriod, setPerformancePeriod] = useState<ChartPeriod>('daily');
  const [hourlyPeriod, setHourlyPeriod] = useState<ChartPeriod>('daily');
  const [commissionPeriod, setCommissionPeriod] = useState<ChartPeriod>('daily');
  const [medianPeriod, setMedianPeriod] = useState<ChartPeriod>('daily');
  const [distributionPeriod, setDistributionPeriod] = useState<ChartPeriod>('daily');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [riskScore, setRiskScore] = useState(0);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [medianHourly, setMedianHourly] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [context, setContext] = useState({ workerId: '', zone: 'N/A', category: 'N/A' });
  const [hourlyPlatform, setHourlyPlatform] = useState('all');
  const [commissionPlatform, setCommissionPlatform] = useState('all');

  async function runAnomalyAnalysis(workerId: string, currentShifts: Shift[], isSilent = false) {
    if (!isSilent) setIsAnalyzing(true);
    try {
      const earningsForAnomaly = currentShifts
        .map((s) => ({
          shift_date: String(s.shift_date || '').slice(0, 10),
          platform: String(s.platform || 'Other'),
          gross_earned: Number(s.gross_earned || 0),
          platform_deductions: Number(s.platform_deductions || 0),
          net_received: Number(s.net_received || 0),
          hours_worked: Number(s.hours_worked || 0),
        }))
        .filter((row) => Boolean(asDate(row.shift_date)));

      const anomalyRes = await fetch(`${API_BASE.anomaly}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: workerId, earnings: earningsForAnomaly.slice(0, 90) }),
      });

      if (anomalyRes.ok) {
        const anomalyPayload = await anomalyRes.json();
        setAnomalies(Array.isArray(anomalyPayload?.anomalies) ? anomalyPayload.anomalies : []);
        setRiskScore(Number(anomalyPayload?.risk_score || 0));
      } else {
        if (!isSilent) alert("Analysis failed. Try again.");
        setAnomalies([]);
        setRiskScore(0);
      }
    } catch {
      if (!isSilent) alert("Analysis failed. Try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function loadDashboard() {
    const workerId = localStorage.getItem('fairgig_user_id') || '';
    const zone = localStorage.getItem('fairgig_city_zone') || 'DHA';
    const category = localStorage.getItem('fairgig_category') || 'ride_hailing';

    setContext({ workerId, zone, category });
    if (!workerId) {
      setError('Missing worker profile. Please log in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const shiftsRes = await authFetch(`${API_BASE.earnings}/shifts?worker_id=${encodeURIComponent(workerId)}`, { cache: 'no-store' });
      const shiftsPayload = await shiftsRes.json();
      const shiftRows: Shift[] = Array.isArray(shiftsPayload) ? shiftsPayload : [];
      setShifts(shiftRows);

      const [complaintsRes, medianRes] = await Promise.all([
        authFetch(`${API_BASE.grievance}/api/complaints/mine`, { cache: 'no-store' }),
        fetch(`${API_BASE.analytics}/analytics/median/${encodeURIComponent(category)}/${encodeURIComponent(zone)}`, { cache: 'no-store' }),
      ]);

      void runAnomalyAnalysis(workerId, shiftRows, true);

      if (complaintsRes.ok) {
        const compData = await complaintsRes.json();
        setComplaints(Array.isArray(compData) ? compData : []);
      }

      let medianValue = 0;
      if (medianRes.ok) {
        const medianPayload = await medianRes.json();
        medianValue = Number(medianPayload.median_hourly || 0);
      }
      setMedianHourly(medianValue);
    } catch {
      setError('Could not load worker analytics dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setIsMounted(true);
    void loadDashboard();
  }, []);

  const kpis = useMemo(() => {
    const net = shifts.reduce((a, b) => a + Number(b.net_received || 0), 0);
    const hrs = shifts.reduce((a, b) => a + Number(b.hours_worked || 0), 0);
    const verified = shifts.filter((s) => s.verification_status === 'verified').length;
    return {
      net,
      hourly: hrs > 0 ? net / hrs : 0,
      shifts: shifts.length,
      verified,
    };
  }, [shifts]);

  const monthSummary = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const prevDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    let currentNet = 0;
    let currentHours = 0;
    let prevNet = 0;
    let prevHours = 0;

    for (const s of shifts) {
      const d = asDate(s.shift_date);
      if (!d) continue;
      const net = Number(s.net_received || 0);
      const hrs = Number(s.hours_worked || 0);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        currentNet += net;
        currentHours += hrs;
      }
      if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
        prevNet += net;
        prevHours += hrs;
      }
    }

    const currentHourly = currentHours > 0 ? currentNet / currentHours : 0;
    const prevHourly = prevHours > 0 ? prevNet / prevHours : 0;

    const netGrowth = prevNet > 0 ? ((currentNet - prevNet) / prevNet) * 100 : 0;
    const hourlyGrowth = prevHourly > 0 ? ((currentHourly - prevHourly) / prevHourly) * 100 : 0;

    return {
      monthLabel: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now),
      currentNet,
      currentHourly,
      netGrowth,
      hourlyGrowth,
    };
  }, [shifts]);

  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => new Date(b.shift_date).getTime() - new Date(a.shift_date).getTime());
  }, [shifts]);

  const performanceShifts = useMemo(() => filterShiftsByPeriod(sortedShifts, performancePeriod), [sortedShifts, performancePeriod]);
  const hourlyShifts = useMemo(() => filterShiftsByPeriod(sortedShifts, hourlyPeriod), [sortedShifts, hourlyPeriod]);
  const commissionShifts = useMemo(() => filterShiftsByPeriod(sortedShifts, commissionPeriod), [sortedShifts, commissionPeriod]);
  const medianShifts = useMemo(() => filterShiftsByPeriod(sortedShifts, medianPeriod), [sortedShifts, medianPeriod]);
  const distributionShifts = useMemo(() => filterShiftsByPeriod(sortedShifts, distributionPeriod), [sortedShifts, distributionPeriod]);

  const platformOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of shifts) {
      const p = (s.platform || '').toLowerCase().trim();
      if (p) set.add(p);
    }
    return ['all', ...Array.from(set)];
  }, [shifts]);

  const hourlyPlatformShifts = useMemo(() => {
    if (hourlyPlatform === 'all') return hourlyShifts;
    return hourlyShifts.filter((s) => (s.platform || '').toLowerCase() === hourlyPlatform);
  }, [hourlyShifts, hourlyPlatform]);

  const commissionPlatformShifts = useMemo(() => {
    if (commissionPlatform === 'all') return commissionShifts;
    return commissionShifts.filter((s) => (s.platform || '').toLowerCase() === commissionPlatform);
  }, [commissionShifts, commissionPlatform]);

  const topPlatform = useMemo(() => {
    const totals = new Map<string, number>();
    for (const s of shifts) {
      const p = (s.platform || 'other').toLowerCase();
      totals.set(p, (totals.get(p) || 0) + Number(s.net_received || 0));
    }
    let best = 'N/A';
    let bestValue = 0;
    for (const [k, v] of totals.entries()) {
      if (v > bestValue) {
        best = k;
        bestValue = v;
      }
    }
    return { name: best.toUpperCase(), value: bestValue };
  }, [shifts]);

  const performanceOption: EChartsOption = useMemo(() => {
    const bucketed = new Map<string, number>();
    const unit = bucketUnitFromPeriod(performancePeriod);
    const anomalyMap = new Map<string, AnomalyItem[]>();

    for (const s of performanceShifts) {
      const dOptions = asDate(s.shift_date);
      if (!dOptions) continue;
      const key = bucketKeyForDate(dOptions, unit);
      bucketed.set(key, (bucketed.get(key) || 0) + Number(s.net_received || 0));
    }

    for (const a of anomalies) {
      const ad = asDate(a.affected_date);
      if (!ad) continue;
      const key = bucketKeyForDate(ad, unit);
      const list = anomalyMap.get(key) || [];
      list.push(a);
      anomalyMap.set(key, list);
    }

    const keys = Array.from(bucketed.keys()).sort((a, b) => a.localeCompare(b));
    const labels = keys.map((k) => bucketLabelFromKey(k, unit));
    const netData = keys.map((k) => bucketed.get(k) || 0);

    const anomalyPoints = keys.map((k, idx) => {
      const list = anomalyMap.get(k);
      if (list && list.length > 0) {
        return {
          value: [labels[idx], netData[idx]],
          symbolSize: 14,
          itemStyle: { color: '#dc2626', shadowBlur: 10, shadowColor: 'rgba(220,38,38,0.8)' },
          alertDetails: list,
        };
      }
      return null;
    }).filter(Boolean);

    return {
      tooltip: {
        trigger: 'axis',
        confine: true,
        borderColor: '#1e293b',
        backgroundColor: '#020617',
        textStyle: { color: '#e2e8f0' },
        extraCssText: 'max-width:320px; white-space:normal; word-break:break-word; border-radius:12px; box-shadow:0 12px 30px rgba(2,6,23,0.45);',
        formatter: (params: any) => {
          const p = params[0];
          let html = `<b>${p.name}</b><br/>Earnings: PKR ${Number(p.value || 0).toFixed(2)}`;
          const match = anomalyPoints.find((ap) => ap?.value[0] === p.name);
          if (match) {
            html += `<hr style="margin:4px 0;"/><span style="color:#dc2626;font-weight:bold;">Anomalies Detected:</span><br/>`;
            match.alertDetails.forEach((a: any) => {
              html += `- ${a.type} (${a.severity})<br/>`;
            });
          }
          html += '</div>';
          return html;
        }
      },
      grid: { left: 40, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: { lineStyle: { color: '#334155' } },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8' },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { type: 'dashed', color: 'rgba(148,163,184,0.25)' } },
      },
      series: [
        {
          name: 'Earnings',
          type: 'line',
          smooth: true,
          symbol: 'none',
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(56, 189, 248, 0.45)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
              ]
            }
          },
          lineStyle: { width: 3, color: '#38bdf8' },
          data: netData
        },
        {
          name: 'Anomalies',
          type: 'effectScatter',
          coordinateSystem: 'cartesian2d',
          symbolSize: 12,
          z: 20,
          showEffectOn: 'render',
          rippleEffect: { period: 2.2, scale: 3.2, brushType: 'stroke' },
          itemStyle: { color: '#dc2626' },
          data: anomalyPoints as any
        }
      ]
    };
  }, [performanceShifts, anomalies, performancePeriod]);

  const hourlyRateOption: EChartsOption = useMemo(() => {
    const unit = bucketUnitFromPeriod(hourlyPeriod);
    const byBucket = new Map<string, { net: number; hours: number }>();
    for (const s of hourlyPlatformShifts) {
      const d = asDate(s.shift_date);
      if (!d) continue;
      const key = bucketKeyForDate(d, unit);
      const existing = byBucket.get(key) || { net: 0, hours: 0 };
      existing.net += Number(s.net_received || 0);
      existing.hours += Number(s.hours_worked || 0);
      byBucket.set(key, existing);
    }

    const keys = Array.from(byBucket.keys()).sort((a, b) => a.localeCompare(b));
    const labels = keys.map((k) => bucketLabelFromKey(k, unit));
    const rates = keys.map((k) => {
      const row = byBucket.get(k);
      if (!row || row.hours <= 0) return 0;
      return Number((row.net / row.hours).toFixed(2));
    });

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params?.[0];
          if (!p) return '';
          return `<b>${p.name}</b><br/>Effective hourly: PKR ${Number(p.value || 0).toFixed(2)}`;
        },
      },
      grid: { left: 40, right: 12, top: 16, bottom: 26 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#64748b' },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbolSize: 6,
          lineStyle: { width: 3, color: '#0891b2' },
          itemStyle: { color: '#0891b2' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(8,145,178,0.25)' },
                { offset: 1, color: 'rgba(8,145,178,0.03)' },
              ],
            },
          },
          data: rates,
        },
      ],
    };
  }, [hourlyPlatformShifts, hourlyPeriod]);

  const commissionTrackerOption: EChartsOption = useMemo(() => {
    const unit = bucketUnitFromPeriod(commissionPeriod);
    const byBucket = new Map<string, { gross: number; deductions: number }>();
    for (const s of commissionPlatformShifts) {
      const d = asDate(s.shift_date);
      if (!d) continue;
      const key = bucketKeyForDate(d, unit);
      const item = byBucket.get(key) || { gross: 0, deductions: 0 };
      item.gross += Number(s.gross_earned || 0);
      item.deductions += Number(s.platform_deductions || 0);
      byBucket.set(key, item);
    }

    const keys = Array.from(byBucket.keys()).sort((a, b) => a.localeCompare(b));
    const labels = keys.map((k) => bucketLabelFromKey(k, unit));
    const rates = keys.map((k) => {
      const item = byBucket.get(k);
      if (!item || item.gross <= 0) return 0;
      return Number(((item.deductions / item.gross) * 100).toFixed(2));
    });

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params?.[0];
          if (!p) return '';
          return `<b>${String(p.name).toUpperCase()}</b><br/>Commission: ${Number(p.value || 0).toFixed(2)}%`;
        },
      },
      grid: { left: 38, right: 14, top: 16, bottom: 30 },
      backgroundColor: 'transparent',
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#94a3b8' },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
      },
      series: [
        {
          name: 'Commission %',
          type: 'line',
          smooth: false,
          step: 'middle',
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: '#38bdf8' },
          itemStyle: { color: '#38bdf8' },
          data: rates,
        },
      ],
    };
  }, [commissionPlatformShifts, commissionPeriod]);

  const cityMedianOption: EChartsOption = useMemo(() => {
    const totalNet = medianShifts.reduce((sum, s) => sum + Number(s.net_received || 0), 0);
    const totalHours = medianShifts.reduce((sum, s) => sum + Number(s.hours_worked || 0), 0);
    const workerHourly = totalHours > 0 ? Number((totalNet / totalHours).toFixed(2)) : 0;

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const lines = (params || []).map((p: any) => `${p.marker}${p.seriesName}: PKR ${Number(p.value || 0).toFixed(2)}`);
          return lines.join('<br/>');
        },
      },
      grid: { left: 38, right: 12, top: 24, bottom: 24 },
      backgroundColor: 'transparent',
      xAxis: {
        type: 'category',
        data: ['You', 'City Median'],
        axisLabel: { color: '#94a3b8' },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
      },
      series: [
        {
          name: 'Mine',
          type: 'bar',
          barMaxWidth: 38,
          itemStyle: { color: '#22c55e', borderRadius: [8, 8, 0, 0] },
          data: [workerHourly, 0],
        },
        {
          name: 'City Median',
          type: 'bar',
          barMaxWidth: 38,
          itemStyle: { color: '#38bdf8', borderRadius: [8, 8, 0, 0] },
          data: [0, medianHourly || 0],
        },
      ],
    };
  }, [medianShifts, medianHourly]);

  const platformDistributionOption: EChartsOption = useMemo(() => {
    const platformNet = new Map<string, number>();
    for (const s of distributionShifts) {
      const key = (s.platform || 'other').toLowerCase();
      platformNet.set(key, (platformNet.get(key) || 0) + Number(s.net_received || 0));
    }

    const data = Array.from(platformNet.entries()).map(([name, value]) => ({
      name: name.toUpperCase(),
      value: Number(value.toFixed(2)),
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `${params.name}<br/>Net: PKR ${Number(params.value || 0).toLocaleString()} (${Number(params.percent || 0).toFixed(1)}%)`,
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#64748b', fontSize: 11 },
      },
      series: [
        {
          name: 'Platform Distribution',
          type: 'pie',
          radius: ['38%', '68%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 8, borderColor: '#ffffff', borderWidth: 2 },
          label: {
            show: true,
            color: '#334155',
            formatter: '{d}%',
            fontSize: 11,
          },
          data,
        },
      ],
    };
  }, [distributionShifts]);

  const showInitialLoader = !isMounted || (loading && !shifts.length);

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_500px_at_20%_-10%,rgba(14,165,233,0.10),transparent),radial-gradient(1000px_450px_at_90%_0%,rgba(16,185,129,0.12),transparent),#f8fafc] p-4 sm:p-6">
      {showInitialLoader ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-white/35 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        </div>
      ) : null}
      <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-4 sm:gap-5">
        {error && (
          <div className="col-span-12 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* ROW 1: KPI CARDS */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Net</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Month: {monthSummary.monthLabel}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">PKR {Math.round(monthSummary.currentNet).toLocaleString()}</p>
          <p className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${monthSummary.netGrowth >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {monthSummary.netGrowth >= 0 ? '+' : ''}{monthSummary.netGrowth.toFixed(1)}% vs previous month
          </p>
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hourly Average</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Month: {monthSummary.monthLabel}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">PKR {Math.round(monthSummary.currentHourly).toLocaleString()}</p>
          <p className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${monthSummary.hourlyGrowth >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {monthSummary.hourlyGrowth >= 0 ? '+' : ''}{monthSummary.hourlyGrowth.toFixed(1)}% vs previous month
          </p>
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Top Earning Platform</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{topPlatform.name}</p>
          <p className="mt-2 text-xs font-semibold text-sky-600">PKR {Math.round(topPlatform.value).toLocaleString()} earned</p>
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Complaints</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{complaints.filter((c) => c.status !== 'resolved').length}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Open cases currently in pipeline</p>
        </div>

        {/* ROW 2: CHARTS */}
        <div className="col-span-12 lg:col-span-8 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl shadow-slate-900/20">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Performance (Earnings & Alerts)</h2>
              <p className="text-xs text-slate-300">Red markers show anomaly dates with full descriptions in tooltip.</p>
            </div>
            <PeriodSelect value={performancePeriod} onChange={setPerformancePeriod} dark />
          </div>
          <div className="h-72">
            {performanceShifts.length > 0 ? (
              <ReactECharts option={performanceOption} style={{ height: '100%', width: '100%' }} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-300">No performance data in selected range.</div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Distribution By Platform</h2>
            <PeriodSelect value={distributionPeriod} onChange={setDistributionPeriod} />
          </div>
          <p className="mb-3 text-xs text-slate-500">Net earnings split by platform for selected period.</p>
          <div className="h-72">
            {distributionShifts.length > 0 ? (
              <ReactECharts option={platformDistributionOption} style={{ height: '100%', width: '100%' }} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No platform distribution data yet.</div>
            )}
          </div>
        </div>

        {/* ROW 3: ANOMALY REPORT PANEL */}
        <AnomalyReportPanel
          anomalies={anomalies}
          riskScore={riskScore}
          isAnalyzing={isAnalyzing}
          onRun={() => runAnomalyAnalysis(context.workerId, shifts, false)}
        />

        <div className="col-span-12 lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Effective Hourly Rate Over Time</h2>
            <div className="flex items-center gap-2">
              <select
                value={hourlyPlatform}
                onChange={(e) => setHourlyPlatform(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
              >
                {platformOptions.map((p) => (
                  <option key={`hourly-${p}`} value={p}>{p === 'all' ? 'All Platforms' : p.toUpperCase()}</option>
                ))}
              </select>
              <PeriodSelect value={hourlyPeriod} onChange={setHourlyPeriod} />
            </div>
          </div>
          <div className="h-64">
            {hourlyPlatformShifts.length > 0 ? (
              <ReactECharts option={hourlyRateOption} style={{ height: '100%', width: '100%' }} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No hourly trend data yet.</div>
            )}
          </div>
        </div>

        <div className="col-span-12 md:col-span-6 lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Platform Commission Rate Tracker</h2>
            <div className="flex items-center gap-2">
              <select
                value={commissionPlatform}
                onChange={(e) => setCommissionPlatform(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
              >
                {platformOptions.map((p) => (
                  <option key={`commission-${p}`} value={p}>{p === 'all' ? 'All Platforms' : p.toUpperCase()}</option>
                ))}
              </select>
              <PeriodSelect value={commissionPeriod} onChange={setCommissionPeriod} />
            </div>
          </div>
          <div className="h-64">
            {commissionPlatformShifts.length > 0 ? (
              <ReactECharts option={commissionTrackerOption} style={{ height: '100%', width: '100%' }} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">No commission trend data yet.</div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">City Median Comparison</h2>
            <PeriodSelect value={medianPeriod} onChange={setMedianPeriod} dark />
          </div>
          <p className="mb-3 text-xs text-slate-400">Compared against anonymised city-wide median for your category.</p>
          <div className="h-64">
            {medianShifts.length > 0 ? (
              <ReactECharts option={cityMedianOption} style={{ height: '100%', width: '100%' }} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No comparison data yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
