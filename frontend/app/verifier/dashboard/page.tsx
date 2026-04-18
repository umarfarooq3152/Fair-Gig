'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API_BASE, authFetch } from '@/lib/api';

type WeeklyPoint = {
  day: string;
  verified: number;
  flagged: number;
  unverifiable: number;
};

type DashboardStats = {
  total_verified: number;
  flagged_discrepancies: number;
  marked_unverifiable: number;
  accuracy_rate: number;
  weekly_activity: WeeklyPoint[];
};

type QueueItem = {
  id: string;
  worker_name: string;
  platform: string;
  net_received: number;
  shift_date: string;
  status?: string;
  reviewed_at?: string;
  submitted_at?: string;
  created_at?: string;
};

type Profile = {
  name?: string;
  email?: string;
  created_at?: string;
  verifications_today?: number;
};

type ShiftRow = {
  id: string;
  worker_name?: string;
  platform?: string;
  net_received?: number;
  shift_date?: string;
  verification_status?: string;
  verifier_id?: string;
  created_at?: string;
  updated_at?: string;
  verified_at?: string;
};

const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function numberValue(input: unknown) {
  const n = Number(input);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
}

function formatDate(value: string | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatRelativeTime(value: string | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const absMinutes = Math.abs(Math.round(diffMs / 60000));

  if (absMinutes < 60) return rtf.format(Math.round(diffMs / 60000), 'minute');
  const absHours = Math.abs(Math.round(diffMs / 3600000));
  if (absHours < 24) return rtf.format(Math.round(diffMs / 3600000), 'hour');
  return rtf.format(Math.round(diffMs / 86400000), 'day');
}

function shortDay(value: string) {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return dayOrder[date.getDay()];
  return value.slice(0, 3);
}

function initials(name: string) {
  const parts = name
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'V';
}

function normalizeStatus(status?: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'verified' || normalized === 'flagged' || normalized === 'unverifiable') return normalized;
  return 'pending';
}

function statusClass(status?: string) {
  const normalized = normalizeStatus(status);
  if (normalized === 'verified') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
  if (normalized === 'flagged') return 'bg-amber-100 text-amber-700 border-amber-300';
  if (normalized === 'unverifiable') return 'bg-rose-100 text-rose-700 border-rose-300';
  return 'bg-blue-100 text-blue-700 border-blue-300';
}

async function fetchVerifier(path: string, options?: RequestInit) {
  const candidates = [`/api/verifier${path}`, `${API_BASE.earnings}/verifier${path}`];
  let last: Response | null = null;

  for (const url of candidates) {
    const res = await authFetch(url, options);
    if (res.ok) return res;
    last = res;
    if (res.status !== 404) break;
  }

  if (!last) throw new Error('Verifier API unavailable');
  return last;
}

async function fetchJsonOrNull(path: string) {
  try {
    const res = await fetchVerifier(path, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function deriveFromShifts(shifts: ShiftRow[]) {
  const reviewed = shifts.filter((s) => normalizeStatus(s.verification_status) !== 'pending');

  const totalVerified = reviewed.filter((s) => normalizeStatus(s.verification_status) === 'verified').length;
  const totalFlagged = reviewed.filter((s) => normalizeStatus(s.verification_status) === 'flagged').length;
  const totalUnverifiable = reviewed.filter((s) => normalizeStatus(s.verification_status) === 'unverifiable').length;
  const accuracyRate = reviewed.length ? (totalVerified / reviewed.length) * 100 : 0;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const buckets = new Map<string, WeeklyPoint>();
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const key = shortDay(day.toISOString());
    buckets.set(key, { day: key, verified: 0, flagged: 0, unverifiable: 0 });
  }

  reviewed.forEach((row) => {
    const when = new Date(row.verified_at || row.updated_at || row.shift_date || row.created_at || '');
    if (Number.isNaN(when.getTime()) || when < weekStart) return;
    const key = shortDay(when.toISOString());
    const bucket = buckets.get(key);
    if (!bucket) return;
    const status = normalizeStatus(row.verification_status);
    if (status === 'verified') bucket.verified += 1;
    if (status === 'flagged') bucket.flagged += 1;
    if (status === 'unverifiable') bucket.unverifiable += 1;
  });

  return {
    stats: {
      total_verified: totalVerified,
      flagged_discrepancies: totalFlagged,
      marked_unverifiable: totalUnverifiable,
      accuracy_rate: accuracyRate,
      weekly_activity: Array.from(buckets.values()),
    } as DashboardStats,
    reviewed,
  };
}

function cardStyle(label: string) {
  if (label === 'Total Verified') return { icon: CheckCircle2, color: 'text-emerald-600' };
  if (label === 'Flagged Discrepancies') return { icon: AlertTriangle, color: 'text-amber-600' };
  if (label === 'Marked Unverifiable') return { icon: XCircle, color: 'text-rose-600' };
  return { icon: ShieldCheck, color: 'text-indigo-600' };
}

export default function VerifierDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStats>({
    total_verified: 0,
    flagged_discrepancies: 0,
    marked_unverifiable: 0,
    accuracy_rate: 0,
    weekly_activity: [],
  });
  const [recent, setRecent] = useState<QueueItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError('');

      const verifierId = localStorage.getItem('fairgig_user_id') || '';
      const [statsPayload, queuePayload, profilePayload, shiftsPayload, mePayload] = await Promise.all([
        fetchJsonOrNull('/stats'),
        fetchJsonOrNull('/queue'),
        fetchJsonOrNull('/profile'),
        authFetch(`${API_BASE.earnings}/shifts`, { cache: 'no-store' }).then(async (res) => (res.ok ? await res.json() : null)),
        authFetch(`${API_BASE.auth}/me`, { cache: 'no-store' }).then(async (res) => (res.ok ? await res.json() : null)),
      ]);

      const allShifts = Array.isArray(shiftsPayload) ? (shiftsPayload as ShiftRow[]) : [];
      const verifierShifts = allShifts.filter((row) => String(row.verifier_id || '') === verifierId);
      const derived = deriveFromShifts(verifierShifts);

      if (statsPayload && typeof statsPayload === 'object') {
        setStats({
          total_verified: numberValue((statsPayload as any).total_verified),
          flagged_discrepancies: numberValue((statsPayload as any).flagged_discrepancies),
          marked_unverifiable: numberValue((statsPayload as any).marked_unverifiable),
          accuracy_rate: numberValue((statsPayload as any).accuracy_rate),
          weekly_activity: Array.isArray((statsPayload as any).weekly_activity)
            ? (statsPayload as any).weekly_activity.map((r: any) => ({
                day: shortDay(String(r?.day || r?.date || '')),
                verified: numberValue(r?.verified),
                flagged: numberValue(r?.flagged),
                unverifiable: numberValue(r?.unverifiable),
              }))
            : derived.stats.weekly_activity,
        });
      } else {
        setStats(derived.stats);
      }

      const queueRows: QueueItem[] = Array.isArray(queuePayload)
        ? (queuePayload as any[]).map((row) => ({
            id: String(row?.id || row?.shift_id || ''),
            worker_name: String(row?.worker_name || 'Unknown worker'),
            platform: String(row?.platform || '—'),
            net_received: numberValue(row?.net_received),
            shift_date: String(row?.shift_date || row?.submitted_at || row?.created_at || ''),
            status: String(row?.status || row?.verification_status || 'pending'),
            reviewed_at: String(row?.reviewed_at || row?.verified_at || row?.updated_at || ''),
            submitted_at: String(row?.submitted_at || row?.created_at || ''),
            created_at: String(row?.created_at || ''),
          }))
        : [];

      const fallbackRecent: QueueItem[] = derived.reviewed
        .slice()
        .sort((a, b) => new Date(b.verified_at || b.updated_at || '').getTime() - new Date(a.verified_at || a.updated_at || '').getTime())
        .slice(0, 5)
        .map((row) => ({
          id: row.id,
          worker_name: row.worker_name || 'Unknown worker',
          platform: row.platform || '—',
          net_received: numberValue(row.net_received),
          shift_date: row.shift_date || row.created_at || '',
          status: row.verification_status || 'pending',
          reviewed_at: row.verified_at || row.updated_at || '',
          submitted_at: row.created_at || '',
          created_at: row.created_at || '',
        }));

      setRecent((queueRows.length ? queueRows : fallbackRecent).slice(0, 5));

      const me = (profilePayload && typeof profilePayload === 'object' ? profilePayload : mePayload) as any;
      if (me && typeof me === 'object') {
        setProfile({
          name: String(me?.name || me?.full_name || 'Verifier'),
          email: typeof me?.email === 'string' ? me.email : '',
          created_at: String(me?.created_at || me?.member_since || ''),
          verifications_today: numberValue(me?.verifications_today),
        });
      } else {
        setProfile({
          name: localStorage.getItem('fairgig_user_name') || 'Verifier',
          email: '',
          created_at: '',
          verifications_today: 0,
        });
      }
    } catch {
      setError('Could not load verifier dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const averageReviewTime = useMemo(() => {
    const diffs = recent
      .map((item) => {
        const submitted = new Date(item.submitted_at || item.created_at || '').getTime();
        const reviewed = new Date(item.reviewed_at || '').getTime();
        if (!submitted || !reviewed || Number.isNaN(submitted) || Number.isNaN(reviewed) || reviewed <= submitted) return null;
        return (reviewed - submitted) / 60000;
      })
      .filter((value): value is number => value !== null);

    if (!diffs.length) return null;
    return diffs.reduce((sum, item) => sum + item, 0) / diffs.length;
  }, [recent]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium animate-pulse">Loading verifier dashboard...</div>;
  }

  const statRows = [
    { label: 'Total Verified', value: stats.total_verified.toLocaleString() },
    { label: 'Flagged Discrepancies', value: stats.flagged_discrepancies.toLocaleString() },
    { label: 'Marked Unverifiable', value: stats.marked_unverifiable.toLocaleString() },
    { label: 'Accuracy Rate', value: `${stats.accuracy_rate.toFixed(1)}%` },
  ];

  const activityFeed = recent.slice(0, 8);

  return (
    <div className="flex flex-col xl:flex-row gap-6 bg-slate-50 min-h-screen">
      <div className="flex-1 space-y-6">
        <div className="flex justify-between items-center bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Dashboard Overview</h1>
            <p className="text-sm text-slate-500">Welcome back! Here is your latest verification performance.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} className="px-4 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg text-sm hover:bg-indigo-100 transition">
              Refresh
            </button>
            <button className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg text-sm hover:bg-slate-800 transition">
              Export Report
            </button>
          </div>
        </div>

        {error ? <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">{error}</div> : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statRows.map((row) => {
            const conf = cardStyle(row.label);
            const Icon = conf.icon;
            return (
              <div key={row.label} className="p-5 bg-white rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">{row.label}</div>
                  <Icon className={conf.color} size={18} />
                </div>
                <div className="text-2xl font-bold text-slate-800">{row.value}</div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-slate-800">Verification Activity (Last 7 Days)</h2>
            <div className="flex bg-slate-100 rounded-lg p-1 text-xs font-medium">
              <button className="px-3 py-1 bg-white rounded shadow-sm text-slate-800">7 Days</button>
              <button className="px-3 py-1 text-slate-500 hover:text-slate-700">30 Days</button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={stats.weekly_activity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="verified" stackId="a" fill="#16A34A" />
                <Bar dataKey="flagged" stackId="a" fill="#D97706" />
                <Bar dataKey="unverifiable" stackId="a" fill="#DC2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-base font-bold text-slate-800 mb-4">Recent Queue Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 bg-slate-50">
                  <th className="py-3 px-4 font-semibold rounded-tl-lg text-left">Worker</th>
                  <th className="py-3 px-4 font-semibold text-left">Platform</th>
                  <th className="py-3 px-4 font-semibold text-left">Net</th>
                  <th className="py-3 px-4 font-semibold text-left">Date</th>
                  <th className="py-3 px-4 font-semibold rounded-tr-lg text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recent.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-medium text-slate-900">{item.worker_name}</td>
                    <td className="py-3 px-4">{item.platform}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-700">{formatMoney(item.net_received)}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(item.shift_date)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(item.status)}`}>
                        {normalizeStatus(item.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {!recent.length ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-slate-500">No queue activity available.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="w-full xl:w-80 space-y-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
            {initials(profile?.name || 'Verifier')}
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Verifier Profile</h3>
            <p className="text-xs text-slate-500">{profile?.email || 'No email available'}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex justify-between items-center">
            <span>Recent Reviews</span>
            <span className="bg-slate-100 text-slate-500 text-xs py-0.5 px-2 rounded-full">Activity</span>
          </h2>

          <div className="space-y-4">
            {activityFeed.map((item, index) => (
              <div key={`${item.id}-${index}`} className="flex gap-3 items-start">
                <div className="mt-1 w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white bg-indigo-600">
                  {(item.platform || 'P').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <p className="text-sm font-bold text-slate-800">{item.worker_name}</p>
                    <p className="text-sm font-bold text-emerald-600">{formatMoney(item.net_received)}</p>
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <p className="text-xs text-slate-500">{formatRelativeTime(item.reviewed_at || item.shift_date)}</p>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusClass(item.status)}`}>
                      {normalizeStatus(item.status)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {!activityFeed.length ? (
              <p className="text-sm text-slate-400 italic text-center py-4">No recent verification activity.</p>
            ) : null}
          </div>

          <div className="mt-5 space-y-2 text-sm border-t border-slate-100 pt-4">
            <p><span className="text-slate-500">Member since:</span> <span className="font-medium text-slate-700">{formatDate(profile?.created_at)}</span></p>
            <p><span className="text-slate-500">Verifications today:</span> <span className="font-medium text-slate-700">{(profile?.verifications_today || 0).toLocaleString()}</span></p>
            <p><span className="text-slate-500">Avg. review time:</span> <span className="font-medium text-slate-700">{averageReviewTime === null ? 'N/A' : `${averageReviewTime.toFixed(1)} min`}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
