import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { analyticsBases, anomalyBases, earningsBases } from '../app/config';
import { fetchWithFallback, getErrorMessage } from '../app/helpers';
import type { Shift } from '../app/types';

type Props = {
  workerId: string;
  cityZone?: string | null;
  category?: string | null;
};

type Granularity = 'daily' | 'weekly' | 'monthly' | 'yearly';
type DistributionWindow = 'day' | 'month' | 'year';

type AnomalyItem = {
  type: string;
  severity: string;
  affected_date: string;
  platform?: string;
  explanation?: string;
};

function asDate(dateLike: string) {
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d;
}

function withEmptyGraphic(option: any, hasData: boolean, message: string) {
  if (hasData) return option;
  return {
    ...option,
    xAxis: { show: false },
    yAxis: { show: false },
    series: [],
    graphic: {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: message,
        fill: '#64748b',
        fontSize: 14,
        fontWeight: 500,
      },
    },
  };
}

function getWeekLabel(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function bucketLabel(dateLike: string, granularity: Granularity) {
  const d = asDate(dateLike);
  if (!d) return 'Unknown';
  if (granularity === 'daily') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (granularity === 'yearly') return String(d.getFullYear());
  if (granularity === 'weekly') return getWeekLabel(d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function bucketDisplayLabel(label: string, granularity: Granularity) {
  if (label === 'Unknown') return label;
  if (granularity === 'yearly') return label;

  if (granularity === 'daily') {
    const d = asDate(label);
    if (!d) return label;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  }

  if (granularity === 'weekly') {
    const match = label.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return label;
    return `Week ${Number(match[2])}, ${match[1]}`;
  }

  const match = label.match(/^(\d{4})-(\d{2})$/);
  if (!match) return label;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function filterByWindow(rows: Shift[], window: DistributionWindow) {
  if (rows.length === 0) return rows;
  const dated = rows
    .map((s) => ({ s, d: asDate(s.shift_date) }))
    .filter((x): x is { s: Shift; d: Date } => Boolean(x.d));
  if (dated.length === 0) return rows;

  const latest = dated.reduce((acc, item) => (item.d > acc ? item.d : acc), dated[0].d);
  const cutoff = new Date(latest);
  if (window === 'day') {
    cutoff.setDate(cutoff.getDate() - 1);
  } else if (window === 'month') {
    cutoff.setMonth(cutoff.getMonth() - 1);
  } else {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  }

  return dated.filter((x) => x.d >= cutoff && x.d <= latest).map((x) => x.s);
}

function keepLast<T>(rows: T[], count: number) {
  return rows.length <= count ? rows : rows.slice(rows.length - count);
}

function normalizeAnomalyDate(raw: string) {
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  return raw;
}

export default function WorkerDashboard({ workerId, cityZone, category }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [medianHourly, setMedianHourly] = useState(0);
  const [netGranularity, setNetGranularity] = useState<Granularity>('monthly');
  const [distributionWindow, setDistributionWindow] = useState<DistributionWindow>('month');
  const [hourlyGranularity, setHourlyGranularity] = useState<Granularity>('monthly');
  const [commissionGranularity, setCommissionGranularity] = useState<Granularity>('monthly');
  const [commissionPlatform, setCommissionPlatform] = useState('all');

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const { response: shiftsRes, payload: shiftsPayload } = await fetchWithFallback(
        earningsBases,
        `?worker_id=${encodeURIComponent(workerId)}`,
      );
      if (!shiftsRes.ok) {
        setError(getErrorMessage(shiftsPayload, 'Could not load shift data'));
        setLoading(false);
        return;
      }

      const shiftRows = Array.isArray(shiftsPayload) ? shiftsPayload : [];
      setShifts(shiftRows);

      const earningsForAnomaly = shiftRows.map((s: any) => ({
        shift_date: String(s.shift_date || '').slice(0, 10),
        platform: String(s.platform || 'Other'),
        gross_earned: Number(s.gross_earned || 0),
        platform_deductions: Number(s.platform_deductions || 0),
        net_received: Number(s.net_received || 0),
        hours_worked: Number(s.hours_worked || 0),
      }));

      const [medianRes, anomalyRes] = await Promise.all([
        cityZone && category
          ? fetchWithFallback(analyticsBases, `/median/${encodeURIComponent(category)}/${encodeURIComponent(cityZone)}`)
          : Promise.resolve({ response: { ok: false } as Response, payload: {} }),
        fetchWithFallback(anomalyBases, '/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worker_id: workerId, earnings: earningsForAnomaly }),
        }),
      ]);

      if (medianRes.response.ok) {
        setMedianHourly(Number(medianRes.payload?.median_hourly || 0));
      } else {
        setMedianHourly(0);
      }

      if (anomalyRes.response.ok) {
        const rows = Array.isArray(anomalyRes.payload?.anomalies) ? anomalyRes.payload.anomalies : [];
        setAnomalies(rows as AnomalyItem[]);
      } else {
        setAnomalies([]);
      }
    } catch {
      setError('Could not load worker analytics dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [workerId, cityZone, category]);

  const kpis = useMemo(() => {
    const dated = shifts
      .map((s) => ({ s, d: asDate(s.shift_date) }))
      .filter((x): x is { s: Shift; d: Date } => Boolean(x.d))
      .sort((a, b) => a.d.getTime() - b.d.getTime());

    const latest = dated.length > 0 ? dated[dated.length - 1].d : null;

    function isSameMonth(a: Date, b: Date) {
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
    }

    const currentMonthRows = latest ? dated.filter((x) => isSameMonth(x.d, latest)).map((x) => x.s) : [];
    const previousMonthRows = latest
      ? dated
          .filter((x) => {
            const d = x.d;
            const prev = new Date(latest);
            prev.setMonth(prev.getMonth() - 1);
            return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
          })
          .map((x) => x.s)
      : [];

    const currentNet = currentMonthRows.reduce((acc, s) => acc + Number(s.net_received || 0), 0);
    const prevNet = previousMonthRows.reduce((acc, s) => acc + Number(s.net_received || 0), 0);

    const currentHours = currentMonthRows.reduce((acc, s) => acc + Number(s.hours_worked || 0), 0);
    const prevHours = previousMonthRows.reduce((acc, s) => acc + Number(s.hours_worked || 0), 0);

    const currentHourly = currentHours > 0 ? currentNet / currentHours : 0;
    const prevHourly = prevHours > 0 ? prevNet / prevHours : 0;

    const currentVerified = currentMonthRows.filter((s) => s.verification_status === 'verified').length;
    const prevVerified = previousMonthRows.filter((s) => s.verification_status === 'verified').length;
    const currentVerRate = currentMonthRows.length > 0 ? (currentVerified / currentMonthRows.length) * 100 : 0;
    const prevVerRate = previousMonthRows.length > 0 ? (prevVerified / previousMonthRows.length) * 100 : 0;

    function pctChange(current: number, prev: number) {
      if (prev === 0) {
        return current > 0 ? 100 : 0;
      }
      return ((current - prev) / Math.abs(prev)) * 100;
    }

    return {
      monthLabel: latest ? latest.toLocaleString('en-US', { month: 'long', year: 'numeric' }) : 'This Month',
      net: currentNet,
      avgHourly: currentHourly,
      verifiedRate: currentVerRate,
      netChange: pctChange(currentNet, prevNet),
      hourlyChange: pctChange(currentHourly, prevHourly),
      verChange: pctChange(currentVerRate, prevVerRate),
    };
  }, [shifts]);

  const monthSeries = useMemo(() => {
    const map = new Map<string, { net: number }>();
    for (const s of shifts) {
      const key = bucketLabel(s.shift_date, netGranularity);
      const bucket = map.get(key) || { net: 0 };
      bucket.net += Number(s.net_received || 0);
      map.set(key, bucket);
    }

    const keys = Array.from(map.keys()).sort();
    return {
      keys,
      net: keys.map((k) => Number(map.get(k)?.net || 0)),
    };
  }, [shifts, netGranularity]);

  const hourlyTrend = useMemo(() => {
    const grouped = new Map<string, { hourlySum: number; count: number }>();
    for (const s of shifts) {
      const hours = Number(s.hours_worked || 0);
      const net = Number(s.net_received || 0);
      const hourly = hours > 0 ? net / hours : 0;
      const key = bucketLabel(s.shift_date, hourlyGranularity);
      const bucket = grouped.get(key) || { hourlySum: 0, count: 0 };
      bucket.hourlySum += hourly;
      bucket.count += 1;
      grouped.set(key, bucket);
    }

    const labels = Array.from(grouped.keys()).sort();
    const points = labels.map((label) => {
      const b = grouped.get(label)!;
      return {
        label,
        hourly: b.count > 0 ? b.hourlySum / b.count : 0,
      };
    });

    return keepLast(points, 10);
  }, [shifts, hourlyGranularity]);

  const platformDistribution = useMemo(() => {
    const scoped = filterByWindow(shifts, distributionWindow);
    const byPlatform: Record<string, number> = {};
    for (const s of scoped) {
      const p = s.platform || 'Other';
      byPlatform[p] = (byPlatform[p] || 0) + Number(s.net_received || 0);
    }
    return Object.entries(byPlatform).map(([name, value]) => ({ name, value }));
  }, [shifts, distributionWindow]);

  const platformOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of shifts) {
      if (s.platform) set.add(s.platform);
    }
    return Array.from(set).sort();
  }, [shifts]);

  const commissionTrend = useMemo(() => {
    const relevant = commissionPlatform === 'all' ? shifts : shifts.filter((s) => s.platform === commissionPlatform);
    const grouped = new Map<string, { gross: number; deductions: number }>();
    for (const s of relevant) {
      const key = bucketLabel(s.shift_date, commissionGranularity);
      const bucket = grouped.get(key) || { gross: 0, deductions: 0 };
      bucket.gross += Number(s.gross_earned || 0);
      bucket.deductions += Number(s.platform_deductions || 0);
      grouped.set(key, bucket);
    }

    const labels = Array.from(grouped.keys()).sort();
    const points = labels.map((label) => {
      const b = grouped.get(label)!;
      const rate = b.gross > 0 ? (b.deductions / b.gross) * 100 : 0;
      return { label, rate };
    });

    return keepLast(points, 10);
  }, [shifts, commissionGranularity, commissionPlatform]);

  const grossNetOption = withEmptyGraphic(
    (() => {
      const displayLabels = monthSeries.keys.map((k) => bucketDisplayLabel(k, netGranularity));
      const displayToValue = new Map(displayLabels.map((label, idx) => [label, monthSeries.net[idx] || 0]));

      const groupedByBucket = new Map<string, AnomalyItem[]>();
      for (const a of anomalies) {
        const key = bucketLabel(normalizeAnomalyDate(String(a.affected_date || '')), netGranularity);
        if (!monthSeries.keys.includes(key)) continue;
        const arr = groupedByBucket.get(key) || [];
        arr.push(a);
        groupedByBucket.set(key, arr);
      }

      // Keep one point per anomaly so monthly buckets can show multiple dots.
      const anomalyPoints: Array<{ value: [string, number]; anomalyRow: AnomalyItem }> = [];
      for (const [key, rows] of groupedByBucket.entries()) {
        const display = bucketDisplayLabel(key, netGranularity);
        const baseY = Number(displayToValue.get(display) || 0);
        const spacing = Math.max(baseY * 0.03, 12);
        rows.forEach((row, index) => {
          anomalyPoints.push({
            value: [display, baseY + index * spacing],
            anomalyRow: row,
          });
        });
      }

      return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const rows = Array.isArray(params) ? params : [params];
          const axisName = rows[0]?.axisValueLabel || rows[0]?.name || '';
          const netPoint = rows.find((p: any) => p.seriesName === 'Net Earnings');
          const anomalyPoint = rows.find((p: any) => p.seriesName === 'Anomaly Alerts');

          let html = `<div><strong>${axisName}</strong></div>`;
          if (netPoint) {
            html += `<div>${netPoint.marker} Net Earnings: PKR ${Number(netPoint.value).toFixed(2)}</div>`;
          }

          const anomalyRows = rows
            .filter((p: any) => p.seriesName === 'Anomaly Alerts' && p.data?.anomalyRow)
            .map((p: any) => ({ marker: p.marker, row: p.data.anomalyRow as AnomalyItem }));

          if (anomalyRows.length > 0) {
            for (const item of anomalyRows) {
              const a = item.row;
              html += `<div style=\"margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0;\">`;
              html += `<div>${item.marker} <strong>${a.type}</strong> (${a.severity})</div>`;
              if (a.explanation) html += `<div style=\"max-width:300px;white-space:normal;\">${a.explanation}</div>`;
              html += `</div>`;
            }
          }

          return html;
        },
      },
      legend: { data: ['Net Earnings'], top: 4 },
      xAxis: { type: 'category', data: displayLabels },
      yAxis: [{ type: 'value' }],
      series: [
        { name: 'Net Earnings', type: 'bar', data: monthSeries.net, itemStyle: { color: '#16a34a' } },
        {
          name: 'Anomaly Alerts',
          type: 'effectScatter',
          coordinateSystem: 'cartesian2d',
          data: anomalyPoints,
          symbolSize: 12,
          z: 20,
          showEffectOn: 'render',
          rippleEffect: { period: 2.2, scale: 3.2, brushType: 'stroke' },
          itemStyle: {
            color: '#dc2626',
            shadowBlur: 20,
            shadowColor: 'rgba(220,38,38,0.65)',
          },
          tooltip: { show: true },
        },
      ],
      grid: { left: 36, right: 18, top: 56, bottom: 26 },
    };
    })(),
    monthSeries.keys.length > 0,
    'Log your first shifts to unlock net earnings trends',
  );

  const hourlyOption = withEmptyGraphic(
    {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Effective Hourly'], top: 4 },
      xAxis: { type: 'category', data: hourlyTrend.map((p) => bucketDisplayLabel(p.label, hourlyGranularity)) },
      yAxis: { type: 'value' },
      series: [
        { name: 'Effective Hourly', type: 'line', smooth: true, data: hourlyTrend.map((p) => Number(p.hourly.toFixed(2))), itemStyle: { color: '#2563eb' } },
      ],
      grid: { left: 36, right: 18, top: 56, bottom: 26 },
    },
    hourlyTrend.length > 0,
    'No hourly rate trend yet',
  );

  const commissionOption = withEmptyGraphic(
    {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Commission Rate %'], top: 4 },
      xAxis: { type: 'category', data: commissionTrend.map((p) => bucketDisplayLabel(p.label, commissionGranularity)) },
      yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
      series: [
        {
          name: 'Commission Rate %',
          type: 'line',
          step: 'end',
          data: commissionTrend.map((p) => Number(p.rate.toFixed(2))),
          itemStyle: { color: '#ef4444' },
        },
      ],
      grid: { left: 36, right: 18, top: 56, bottom: 26 },
    },
    commissionTrend.length > 0,
    'No commission snapshots available',
  );

  const platformDonutOption = withEmptyGraphic(
    {
      tooltip: { trigger: 'item' },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 8,
        top: 24,
        bottom: 12,
        textStyle: { fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['32%', '54%'],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          data: platformDistribution,
        },
      ],
    },
    platformDistribution.length > 0,
    'No platform distribution yet',
  );

  const benchmarkOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['My Hourly', 'City Median'] },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Hourly Comparison',
        type: 'line',
        smooth: true,
        data: [Number(kpis.avgHourly.toFixed(2)), Number(medianHourly.toFixed(2))],
        itemStyle: { color: '#0891b2' },
      },
    ],
    legend: { top: 4 },
    grid: { left: 36, right: 18, top: 56, bottom: 26 },
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">Worker Intelligence Dashboard</h2>
          <button type="button" className="rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={() => void loadDashboard()}>
            Refresh Analytics
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Net Earnings</p>
          <p className="mt-1 text-2xl font-black text-slate-900">PKR {kpis.net.toFixed(0)}</p>
          <p className="mt-1 text-xs text-slate-500">{kpis.monthLabel}</p>
          <p className={`mt-2 text-xs font-semibold ${kpis.netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {kpis.netChange >= 0 ? '↑' : '↓'} {Math.abs(kpis.netChange).toFixed(2)}%
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Effective Hourly</p>
          <p className="mt-1 text-2xl font-black text-slate-900">PKR {kpis.avgHourly.toFixed(2)}</p>
          <p className="mt-1 text-xs text-slate-500">{kpis.monthLabel}</p>
          <p className={`mt-2 text-xs font-semibold ${kpis.hourlyChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {kpis.hourlyChange >= 0 ? '↑' : '↓'} {Math.abs(kpis.hourlyChange).toFixed(2)}%
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Verification Success</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{kpis.verifiedRate.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-slate-500">{kpis.monthLabel}</p>
          <p className={`mt-2 text-xs font-semibold ${kpis.verChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {kpis.verChange >= 0 ? '↑' : '↓'} {Math.abs(kpis.verChange).toFixed(2)}%
          </p>
        </article>
      </div>

      <div className="grid auto-rows-[minmax(220px,auto)] gap-4 xl:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-8">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Net Earnings Trend</h3>
            <select
              value={netGranularity}
              onChange={(e) => setNetGranularity(e.target.value as Granularity)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <ReactECharts option={grossNetOption} style={{ height: 300, width: '100%' }} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Income Distribution By Platform</h3>
            <select
              value={distributionWindow}
              onChange={(e) => setDistributionWindow(e.target.value as DistributionWindow)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <option value="day">Today</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <ReactECharts option={platformDonutOption} style={{ height: 300, width: '100%' }} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Effective Hourly Rate Over Time</h3>
            <select
              value={hourlyGranularity}
              onChange={(e) => setHourlyGranularity(e.target.value as Granularity)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <ReactECharts option={hourlyOption} style={{ height: 280, width: '100%' }} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Platform Commission Rate Tracker</h3>
            <div className="flex gap-2">
              <select
                value={commissionGranularity}
                onChange={(e) => setCommissionGranularity(e.target.value as Granularity)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <select
                value={commissionPlatform}
                onChange={(e) => setCommissionPlatform(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
              >
                <option value="all">All Platforms</option>
                {platformOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <ReactECharts option={commissionOption} style={{ height: 280, width: '100%' }} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">City Median Comparison</h3>
          <ReactECharts option={benchmarkOption} style={{ height: 250, width: '100%' }} />
          <p className="text-xs text-slate-500">City median hourly: PKR {medianHourly.toFixed(2)} ({cityZone || 'N/A'} / {category || 'N/A'})</p>
        </section>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading worker analytics...</p>}
    </section>
  );
}
