import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { analyticsBases, anomalyBases, earningsBases, grievanceBases } from '../app/config';
import { fetchWithFallback, getErrorMessage } from '../app/helpers';
import type { ComplaintItem, Shift } from '../app/types';

type Props = {
  workerId: string;
  token: string;
  cityZone?: string | null;
  category?: string | null;
};

type AnomalyPayload = {
  anomalies?: Array<{ type: string; severity: string; affected_date: string; explanation: string }>;
  risk_score?: number;
};

function monthKey(dateLike: string) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

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

export default function WorkerDashboard({ workerId, token, cityZone, category }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [myComplaints, setMyComplaints] = useState<ComplaintItem[]>([]);
  const [spikesCount, setSpikesCount] = useState(0);
  const [medianHourly, setMedianHourly] = useState(0);
  const [anomaly, setAnomaly] = useState<AnomalyPayload>({ anomalies: [], risk_score: 0 });

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

      const [anomalyRes, complaintsRes, spikesRes, medianRes] = await Promise.all([
        fetchWithFallback(anomalyBases, '/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worker_id: workerId, earnings: earningsForAnomaly }),
        }),
        fetchWithFallback(grievanceBases, '/complaints/mine', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchWithFallback(grievanceBases, '/complaints/alerts/spikes?window_hours=3&min_count=5', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        cityZone && category
          ? fetchWithFallback(analyticsBases, `/median/${encodeURIComponent(category)}/${encodeURIComponent(cityZone)}`)
          : Promise.resolve({ response: { ok: false } as Response, payload: {} }),
      ]);

      if (anomalyRes.response.ok) {
        setAnomaly((anomalyRes.payload || {}) as AnomalyPayload);
      } else {
        setAnomaly({ anomalies: [], risk_score: 0 });
      }

      if (complaintsRes.response.ok) {
        setMyComplaints(Array.isArray(complaintsRes.payload) ? complaintsRes.payload : []);
      } else {
        setMyComplaints([]);
      }

      if (spikesRes.response.ok) {
        const items = Array.isArray(spikesRes.payload?.items) ? spikesRes.payload.items : [];
        setSpikesCount(items.length);
      } else {
        setSpikesCount(0);
      }

      if (medianRes.response.ok) {
        setMedianHourly(Number(medianRes.payload?.median_hourly || 0));
      } else {
        setMedianHourly(0);
      }
    } catch {
      setError('Could not load worker analytics dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [workerId, token, cityZone, category]);

  const kpis = useMemo(() => {
    const gross = shifts.reduce((acc, s) => acc + Number(s.gross_earned || 0), 0);
    const deductions = shifts.reduce((acc, s) => acc + Number(s.platform_deductions || 0), 0);
    const net = shifts.reduce((acc, s) => acc + Number(s.net_received || 0), 0);
    const hours = shifts.reduce((acc, s) => acc + Number(s.hours_worked || 0), 0);
    const avgHourly = hours > 0 ? net / hours : 0;

    return {
      gross,
      deductions,
      net,
      hours,
      avgHourly,
      riskScore: Number(anomaly.risk_score || 0),
      anomaliesCount: Array.isArray(anomaly.anomalies) ? anomaly.anomalies.length : 0,
      verifiedRate:
        shifts.length > 0
          ? (shifts.filter((s) => s.verification_status === 'verified').length / shifts.length) * 100
          : 0,
    };
  }, [shifts, anomaly]);

  const monthSeries = useMemo(() => {
    const map = new Map<string, { gross: number; deductions: number; net: number }>();
    for (const s of shifts) {
      const key = monthKey(s.shift_date);
      const bucket = map.get(key) || { gross: 0, deductions: 0, net: 0 };
      bucket.gross += Number(s.gross_earned || 0);
      bucket.deductions += Number(s.platform_deductions || 0);
      bucket.net += Number(s.net_received || 0);
      map.set(key, bucket);
    }

    const keys = Array.from(map.keys()).sort();
    return {
      keys,
      gross: keys.map((k) => Number(map.get(k)?.gross || 0)),
      deductions: keys.map((k) => Number(map.get(k)?.deductions || 0)),
      net: keys.map((k) => Number(map.get(k)?.net || 0)),
    };
  }, [shifts]);

  const hourlyTrend = useMemo(() => {
    const points = shifts
      .map((s) => {
        const d = asDate(s.shift_date);
        if (!d) return null;
        const hours = Number(s.hours_worked || 0);
        const net = Number(s.net_received || 0);
        const hourly = hours > 0 ? net / hours : 0;
        const commission = Number(s.gross_earned || 0) > 0 ? Number(s.platform_deductions || 0) / Number(s.gross_earned || 1) : 0;
        return {
          date: d,
          label: s.shift_date,
          hourly,
          commission,
          net,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a as any).date.getTime() - (b as any).date.getTime()) as Array<{ date: Date; label: string; hourly: number; commission: number; net: number }>;

    return points;
  }, [shifts]);

  const platformDistribution = useMemo(() => {
    const byPlatform: Record<string, number> = {};
    for (const s of shifts) {
      const p = s.platform || 'Other';
      byPlatform[p] = (byPlatform[p] || 0) + Number(s.net_received || 0);
    }
    return Object.entries(byPlatform).map(([name, value]) => ({ name, value }));
  }, [shifts]);

  const verificationCounts = useMemo(() => {
    const submitted = shifts.length;
    const verified = shifts.filter((s) => s.verification_status === 'verified').length;
    const flagged = shifts.filter((s) => s.verification_status === 'flagged').length;
    const unverifiable = shifts.filter((s) => s.verification_status === 'unverifiable').length;
    return { submitted, verified, flagged, unverifiable };
  }, [shifts]);

  const grievanceStatus = useMemo(() => {
    const map: Record<string, number> = { open: 0, escalated: 0, resolved: 0, rejected: 0 };
    for (const g of myComplaints) {
      map[g.status] = (map[g.status] || 0) + 1;
    }
    return [
      { name: 'open', value: map.open || 0 },
      { name: 'escalated', value: map.escalated || 0 },
      { name: 'resolved', value: map.resolved || 0 },
      { name: 'rejected', value: map.rejected || 0 },
    ];
  }, [myComplaints]);

  const anomalyPoints = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const a of anomaly.anomalies || []) {
      const date = String(a.affected_date || '').slice(0, 10);
      byDate[date] = (byDate[date] || 0) + 1;
    }
    return Object.entries(byDate).map(([date, count]) => ({ date, count }));
  }, [anomaly]);

  const grossNetOption = withEmptyGraphic(
    {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Gross', 'Deductions', 'Net'] },
      dataZoom: [{ type: 'slider', bottom: 0 }, { type: 'inside' }],
      xAxis: { type: 'category', data: monthSeries.keys },
      yAxis: [{ type: 'value', name: 'Amount (PKR)' }],
      series: [
        { name: 'Gross', type: 'bar', data: monthSeries.gross, itemStyle: { color: '#0ea5e9' } },
        { name: 'Deductions', type: 'bar', data: monthSeries.deductions, itemStyle: { color: '#f59e0b' } },
        { name: 'Net', type: 'line', smooth: true, data: monthSeries.net, itemStyle: { color: '#16a34a' } },
      ],
      grid: { left: 36, right: 18, top: 36, bottom: 44 },
    },
    monthSeries.keys.length > 0,
    'Log your first shifts to unlock gross vs net trends',
  );

  const hourlyOption = withEmptyGraphic(
    {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Effective Hourly', 'City Median'] },
      dataZoom: [{ type: 'slider', bottom: 0 }, { type: 'inside' }],
      xAxis: { type: 'category', data: hourlyTrend.map((p) => p.label) },
      yAxis: { type: 'value', name: 'PKR / hour' },
      series: [
        { name: 'Effective Hourly', type: 'line', smooth: true, data: hourlyTrend.map((p) => Number(p.hourly.toFixed(2))), itemStyle: { color: '#2563eb' } },
        { name: 'City Median', type: 'line', smooth: true, data: hourlyTrend.map(() => Number(medianHourly.toFixed(2))), itemStyle: { color: '#7c3aed' }, lineStyle: { type: 'dashed' } },
      ],
      grid: { left: 36, right: 18, top: 36, bottom: 44 },
    },
    hourlyTrend.length > 0,
    'No hourly rate trend yet',
  );

  const commissionOption = withEmptyGraphic(
    {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Commission Rate %'] },
      dataZoom: [{ type: 'slider', bottom: 0 }, { type: 'inside' }],
      xAxis: { type: 'category', data: hourlyTrend.map((p) => p.label) },
      yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
      series: [
        {
          name: 'Commission Rate %',
          type: 'line',
          step: 'end',
          data: hourlyTrend.map((p) => Number((p.commission * 100).toFixed(2))),
          itemStyle: { color: '#ef4444' },
        },
      ],
      grid: { left: 36, right: 18, top: 36, bottom: 44 },
    },
    hourlyTrend.length > 0,
    'No commission snapshots available',
  );

  const platformDonutOption = withEmptyGraphic(
    {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['45%', '72%'],
          avoidLabelOverlap: true,
          data: platformDistribution,
        },
      ],
    },
    platformDistribution.length > 0,
    'No platform distribution yet',
  );

  const benchmarkOption = {
    tooltip: { trigger: 'item' },
    radar: {
      indicator: [
        { name: 'My Hourly', max: Math.max(500, Math.ceil(Math.max(kpis.avgHourly, medianHourly) + 100)) },
        { name: 'City Median Hourly', max: Math.max(500, Math.ceil(Math.max(kpis.avgHourly, medianHourly) + 100)) },
      ],
      radius: 70,
    },
    series: [
      {
        type: 'radar',
        data: [
          { value: [Number(kpis.avgHourly.toFixed(2)), Number(medianHourly.toFixed(2))], name: 'Benchmark' },
        ],
      },
    ],
  };

  const funnelOption = withEmptyGraphic(
    {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'funnel',
          top: 10,
          bottom: 10,
          left: '10%',
          width: '80%',
          data: [
            { name: 'Submitted', value: verificationCounts.submitted },
            { name: 'Verified', value: verificationCounts.verified },
            { name: 'Flagged', value: verificationCounts.flagged },
            { name: 'Unverifiable', value: verificationCounts.unverifiable },
          ],
        },
      ],
    },
    verificationCounts.submitted > 0,
    'No verification records yet',
  );

  const anomalyTimelineOption = withEmptyGraphic(
    {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Net Earnings', 'Anomaly Hits'] },
      dataZoom: [{ type: 'slider', bottom: 0 }, { type: 'inside' }],
      xAxis: { type: 'category', data: hourlyTrend.map((p) => p.label) },
      yAxis: [{ type: 'value', name: 'Net PKR' }, { type: 'value', name: 'Anomalies', minInterval: 1 }],
      series: [
        { name: 'Net Earnings', type: 'line', smooth: true, data: hourlyTrend.map((p) => p.net), itemStyle: { color: '#0ea5e9' } },
        {
          name: 'Anomaly Hits',
          type: 'scatter',
          yAxisIndex: 1,
          itemStyle: { color: '#dc2626' },
          data: hourlyTrend.map((p) => anomalyPoints.find((a) => a.date === p.label)?.count || 0),
        },
      ],
      grid: { left: 36, right: 18, top: 36, bottom: 44 },
    },
    hourlyTrend.length > 0,
    'No timeline data yet',
  );

  const grievanceOption = withEmptyGraphic(
    {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          roseType: 'radius',
          radius: [20, 80],
          data: grievanceStatus,
        },
      ],
    },
    grievanceStatus.some((s) => s.value > 0),
    'No grievances logged yet',
  );

  const systemicAlertOption = {
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 10,
        splitNumber: 5,
        progress: { show: true, width: 12 },
        axisLine: { lineStyle: { width: 12 } },
        pointer: { show: true },
        detail: { formatter: '{value} spike(s)', fontSize: 12 },
        data: [{ value: Math.min(10, spikesCount) }],
      },
    ],
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Net Earnings</p><p className="mt-1 text-2xl font-black text-slate-900">PKR {kpis.net.toFixed(0)}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Effective Hourly</p><p className="mt-1 text-2xl font-black text-slate-900">PKR {kpis.avgHourly.toFixed(2)}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Verification Success</p><p className="mt-1 text-2xl font-black text-slate-900">{kpis.verifiedRate.toFixed(1)}%</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Anomaly Risk</p><p className="mt-1 text-2xl font-black text-slate-900">{kpis.riskScore}</p><p className="text-xs text-slate-500">{kpis.anomaliesCount} anomaly hit(s)</p></article>
      </div>

      <div className="grid auto-rows-[minmax(220px,auto)] gap-4 xl:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-8">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Gross vs Net Earnings Trend</h3>
          <ReactECharts option={grossNetOption} style={{ height: 300, width: '100%' }} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Income Distribution By Platform</h3>
          <ReactECharts option={platformDonutOption} style={{ height: 300, width: '100%' }} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-6">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Effective Hourly Rate Over Time</h3>
          <ReactECharts option={hourlyOption} style={{ height: 280, width: '100%' }} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-6">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Platform Commission Rate Tracker</h3>
          <ReactECharts option={commissionOption} style={{ height: 280, width: '100%' }} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">City Median Comparison</h3>
          <ReactECharts option={benchmarkOption} style={{ height: 250, width: '100%' }} />
          <p className="text-xs text-slate-500">City median hourly: PKR {medianHourly.toFixed(2)} ({cityZone || 'N/A'} / {category || 'N/A'})</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Verification Funnel</h3>
          <ReactECharts option={funnelOption} style={{ height: 250, width: '100%' }} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Systemic Issue Alert</h3>
          <ReactECharts option={systemicAlertOption} style={{ height: 250, width: '100%' }} />
          <p className="text-xs text-slate-500">Complaints spike signals in your ecosystem (last 3h)</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-8">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Anomaly Timeline</h3>
          <ReactECharts option={anomalyTimelineOption} style={{ height: 280, width: '100%' }} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">My Grievance Lifecycle</h3>
          <ReactECharts option={grievanceOption} style={{ height: 280, width: '100%' }} />
        </section>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading worker analytics...</p>}
    </section>
  );
}
