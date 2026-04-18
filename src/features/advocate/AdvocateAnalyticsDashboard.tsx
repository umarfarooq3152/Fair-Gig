import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsBases, grievanceBases } from '../app/config';
import { fetchWithFallback } from '../app/helpers';

type Summary = {
  total_workers: number;
  registration_mom_pct: number;
  avg_commission_rate: number;
  commission_mom_delta_pp: number;
  active_complaints: number;
  escalated_complaints: number;
  vulnerability_count: number;
};

type CommissionRow = { month: string; platform: string; avg_rate: number };
type IncomeRow = { zone: string; category: string; total_net: number };
type VulnRow = {
  id: string;
  name: string;
  city_zone: string;
  category: string;
  current_month: number;
  previous_month: number;
  drop_percentage: number;
};
type TagCluster = { primary_tag: string; platform: string; complaint_count: number };
type TopCat = { category: string; count: number };

const PLAT_COLORS: Record<string, string> = {
  Careem: '#2563eb',
  Bykea: '#10b981',
  foodpanda: '#ea580c',
  Upwork: '#7c3aed',
  Other: '#64748b',
};
const CAT_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#a855f7'];

function platColor(p: string) {
  return PLAT_COLORS[p] ?? '#64748b';
}

function fmtCat(s: string) {
  const m: Record<string, string> = {
    ride_hailing: 'Ride-hailing',
    food_delivery: 'Food delivery',
    freelance: 'Freelance',
    domestic: 'Domestic',
  };
  return m[s] ?? s.replace(/_/g, ' ');
}

function pivotCommission(rows: CommissionRow[]) {
  if (!rows.length) return { data: [] as Record<string, unknown>[], keys: [] as string[] };
  const months = [...new Set(rows.map((r) => r.month))].sort();
  const keys = [...new Set(rows.map((r) => r.platform))].sort();
  const data = months.map((month) => {
    const row: Record<string, unknown> = { month };
    for (const p of keys) {
      const hit = rows.find((r) => r.month === month && r.platform === p);
      row[p] = hit != null ? Math.round(Number(hit.avg_rate) * 10000) / 100 : null;
    }
    return row;
  });
  return { data, keys };
}

function pivotIncome(rows: IncomeRow[]) {
  if (!rows.length) return { data: [] as Record<string, unknown>[], keys: [] as string[] };
  const zones = [...new Set(rows.map((r) => r.zone))].sort();
  const keys = [...new Set(rows.map((r) => r.category))].sort();
  const data = zones.map((zone) => {
    const row: Record<string, unknown> = { zone };
    for (const c of keys) {
      const hit = rows.find((r) => r.zone === zone && r.category === c);
      row[c] = hit ? Number(hit.total_net) : 0;
    }
    return row;
  });
  return { data, keys };
}

type Props = { token: string };

export default function AdvocateAnalyticsDashboard({ token }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [commission, setCommission] = useState<CommissionRow[]>([]);
  const [income, setIncome] = useState<IncomeRow[]>([]);
  const [flags, setFlags] = useState<VulnRow[]>([]);
  const [top, setTop] = useState<TopCat[]>([]);
  const [clusters, setClusters] = useState<TagCluster[]>([]);
  const [inbox, setInbox] = useState(0);
  const [err, setErr] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartsReady, setChartsReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr([]);
    const errs: string[] = [];
    const since = new Date(Date.now() - 7 * 864e5).toISOString();

    const run = async () => {
      const s = await fetchWithFallback(analyticsBases, '/advocate-summary');
      if (s.response.ok) setSummary(s.payload as Summary);
      else errs.push(`Advocate summary (${s.response.status})`);

      const c = await fetchWithFallback(analyticsBases, '/commission-trends');
      if (c.response.ok) setCommission(Array.isArray(c.payload) ? (c.payload as CommissionRow[]) : []);
      else errs.push(`Commission trends (${c.response.status})`);

      const i = await fetchWithFallback(analyticsBases, '/income-by-zone-category');
      if (i.response.ok) {
        const raw = Array.isArray(i.payload) ? i.payload : [];
        setIncome(
          raw.map((r: Record<string, unknown>) => ({
            zone: String(r.zone),
            category: String(r.category),
            total_net: Number(r.total_net),
          })),
        );
      } else errs.push(`Income by zone (${i.response.status})`);

      const v = await fetchWithFallback(analyticsBases, '/vulnerability-flags');
      if (v.response.ok) setFlags(Array.isArray(v.payload) ? (v.payload as VulnRow[]) : []);
      else errs.push(`Vulnerability flags (${v.response.status})`);

      const t = await fetchWithFallback(analyticsBases, '/top-complaints');
      if (t.response.ok) setTop(Array.isArray(t.payload) ? (t.payload as TopCat[]) : []);
      else errs.push(`Top complaints (${t.response.status})`);

      const cl = await fetchWithFallback(grievanceBases, '/complaints/board/tag-clusters');
      if (cl.response.ok) setClusters(Array.isArray(cl.payload) ? (cl.payload as TagCluster[]) : []);
      else errs.push(`Tag clusters (${cl.response.status})`);

      const u = await fetchWithFallback(
        grievanceBases,
        `/complaints/advocate/new-count?${new URLSearchParams({ since })}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (u.response.ok && u.payload?.count != null) setInbox(Number(u.payload.count));
    };

    try {
      await run();
    } catch (e) {
      errs.push(e instanceof Error ? e.message : 'Network error loading dashboard');
    }
    setErr(errs);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setChartsReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const commPivot = useMemo(() => pivotCommission(commission), [commission]);
  const incPivot = useMemo(() => pivotIncome(income), [income]);

  const topChart = useMemo(
    () => top.map((r) => ({ ...r, label: fmtCat(r.category) })),
    [top],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Labour advocate</p>
          <h2 className="text-2xl font-bold text-slate-900">Advocate analytics panel</h2>
          <p className="text-sm text-slate-600">
            Same data as FairGig Next.js (`/advocate/analytics`) — live from analytics + grievance APIs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            🔔 New (7d): <strong>{inbox}</strong>
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {err.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {err.join(' · ')}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Registered workers</p>
            <p className="mt-1 text-2xl font-bold">{summary?.total_workers?.toLocaleString() ?? '—'}</p>
            <p className="mt-1 text-xs text-emerald-700">
              {summary != null ? `${summary.registration_mom_pct >= 0 ? '+' : ''}${summary.registration_mom_pct}% vs last month` : ''}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Avg platform commission</p>
            <p className="mt-1 text-2xl font-bold">
              {summary != null ? `${summary.avg_commission_rate.toFixed(1)}%` : '—'}
            </p>
            <p className="mt-1 text-xs text-red-700">
              {summary != null
                ? `${summary.commission_mom_delta_pp >= 0 ? '+' : ''}${summary.commission_mom_delta_pp.toFixed(1)} pp vs prev month`
                : ''}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Active grievances</p>
            <p className="mt-1 text-2xl font-bold">{summary?.active_complaints ?? '—'}</p>
            <p className="mt-1 text-xs text-amber-800">{summary?.escalated_complaints ?? '—'} escalated</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Vulnerability flags</p>
            <p className="mt-1 text-2xl font-bold">{summary?.vulnerability_count ?? '—'}</p>
            <p className="mt-1 text-xs text-slate-600">&gt;20% income drop</p>
          </div>
        </div>
      )}

      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Commission rate trends</h3>
        <div className="mt-4 h-[300px] w-full min-w-0">
          {chartsReady && commPivot.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={commPivot.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip />
                <Legend />
                {commPivot.keys.map((p) => (
                  <Line key={p} type="monotone" dataKey={p} stroke={platColor(p)} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-[300px] items-center text-sm text-slate-500">
              {!chartsReady ? 'Preparing chart…' : 'No commission rows in range.'}
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Income by zone & category (30d)</h3>
        <div className="mt-4 h-[300px] w-full min-w-0">
          {chartsReady && incPivot.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={incPivot.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="zone" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${Number(v ?? 0).toLocaleString()} PKR`, '']} />
                <Legend formatter={(v) => fmtCat(String(v))} />
                {incPivot.keys.map((k, i) => (
                  <Bar key={k} dataKey={k} name={k} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">No data</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Workers at risk</h3>
          <div className="mt-3 max-h-[320px] overflow-auto text-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-2">Name</th>
                  <th>Zone</th>
                  <th className="text-right">Drop</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={f.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium">{f.name}</td>
                    <td>{f.city_zone}</td>
                    <td className="text-right text-red-700">−{Number(f.drop_percentage).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {flags.length === 0 ? <p className="text-slate-500">None flagged.</p> : null}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Top complaints (7d)</h3>
          <div className="mt-3 h-[280px] w-full min-w-0">
            {chartsReady && topChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [Number(v ?? 0), 'count']} />
                  <Bar dataKey="count" fill="#6366f1" barSize={16} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No complaints in the last 7 days.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Grievance clusters (tag × platform)</h3>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {clusters.slice(0, 16).map((b) => (
            <div key={`${b.primary_tag}-${b.platform}`} className="flex flex-col items-center text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 text-lg font-bold shadow"
                style={{ borderColor: platColor(b.platform), backgroundColor: `${platColor(b.platform)}22` }}
              >
                {b.complaint_count}
              </div>
              <p className="mt-1 max-w-[100px] text-[11px] font-medium">{b.primary_tag}</p>
              <p className="text-[10px] text-slate-500">{b.platform}</p>
            </div>
          ))}
        </div>
        {clusters.length === 0 ? <p className="text-center text-slate-500">No clusters</p> : null}
      </div>

      <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Using the Next.js app?</strong> Run <code className="rounded bg-white px-1">npm run dev:frontend</code> and open{' '}
        <code className="rounded bg-white px-1">http://localhost:3000/advocate/analytics</code> for the full polished UI. This Vite shell
        mirrors the same API data.
      </p>
    </div>
  );
}
