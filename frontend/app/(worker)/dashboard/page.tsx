'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { EChartsOption } from 'echarts';
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

function formatRelativeTime(dateLike: string) {
  const d = asDate(dateLike);
  if (!d) return dateLike;

  const now = Date.now();
  const diffMs = d.getTime() - now;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const absSec = Math.abs(Math.round(diffMs / 1000));
  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), 'second');

  const absMin = Math.abs(Math.round(diffMs / 60000));
  if (absMin < 60) return rtf.format(Math.round(diffMs / 60000), 'minute');

  const absHr = Math.abs(Math.round(diffMs / 3600000));
  if (absHr < 24) return rtf.format(Math.round(diffMs / 3600000), 'hour');

  const absDay = Math.abs(Math.round(diffMs / 86400000));
  return rtf.format(Math.round(diffMs / 86400000), 'day');
}

export default function WorkerDashboardPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [medianHourly, setMedianHourly] = useState(0);

  const [context, setContext] = useState({ workerId: '', zone: 'N/A', category: 'N/A' });

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

      const earningsForAnomaly = shiftRows
        .map((s) => ({
          shift_date: String(s.shift_date || '').slice(0, 10),
          platform: String(s.platform || 'Other'),
          gross_earned: Number(s.gross_earned || 0),
          platform_deductions: Number(s.platform_deductions || 0),
          net_received: Number(s.net_received || 0),
          hours_worked: Number(s.hours_worked || 0),
        }))
        .filter((row) => Boolean(asDate(row.shift_date)));

      const [anomalyRes, complaintsRes, medianRes] = await Promise.all([
        fetch(`${API_BASE.anomaly}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worker_id: workerId, earnings: earningsForAnomaly }),
        }),
        authFetch(`${API_BASE.grievance}/api/complaints/mine`, { cache: 'no-store' }),
        fetch(`${API_BASE.analytics}/analytics/median/${encodeURIComponent(category)}/${encodeURIComponent(zone)}`, { cache: 'no-store' }),
      ]);

      if (anomalyRes.ok) {
        const anomalyPayload = await anomalyRes.json();
        setAnomalies(Array.isArray(anomalyPayload?.anomalies) ? anomalyPayload.anomalies : []);
      } else {
        setAnomalies([]);
      }

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

  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => new Date(b.shift_date).getTime() - new Date(a.shift_date).getTime());
  }, [shifts]);

  const performanceOption: EChartsOption = useMemo(() => {
    const daily = new Map<string, number>();
    const anomalyMap = new Map<string, AnomalyItem[]>();
    
    // Aggregate shifts by day (simplification for the visual chart)
    for (const s of sortedShifts) {
      const dOptions = asDate(s.shift_date);
      if (!dOptions) continue;
      const dStr = formatShortDate(dOptions);
      daily.set(dStr, (daily.get(dStr) || 0) + Number(s.net_received || 0));
    }

    for (const a of anomalies) {
      const ad = asDate(a.affected_date);
      if (!ad) continue;
      const dStr = formatShortDate(ad);
      const list = anomalyMap.get(dStr) || [];
      list.push(a);
      anomalyMap.set(dStr, list);
    }

    const categories = Array.from(daily.keys()).reverse(); // Older to newer
    const netData = categories.map(c => daily.get(c) || 0);
    
    const anomalyPoints = categories.map((c, idx) => {
      const list = anomalyMap.get(c);
      if (list && list.length > 0) {
        return {
          value: [c, netData[idx]],
          symbolSize: 14,
          itemStyle: { color: '#dc2626', shadowBlur: 10, shadowColor: 'rgba(220,38,38,0.8)' },
          alertDetails: list
        };
      }
      return null;
    }).filter(Boolean);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          let html = `<b>${p.name}</b><br/>Earnings: PKR ${p.value.toFixed(2)}`;
          // Check if there's an anomaly match
          const match = anomalyPoints.find(ap => ap?.value[0] === p.name);
          if (match) {
             html += `<hr style="margin:4px 0;"/><span style="color:#dc2626;font-weight:bold;">Anomalies Detected:</span><br/>`;
             match.alertDetails.forEach((a: any) => {
                html += `- ${a.type} (${a.severity})<br/>`;
             });
          }
          return html;
        }
      },
      grid: { left: 40, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
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
                { offset: 0, color: 'rgba(59, 130, 246, 0.4)' }, // Blue/indigo transition
                { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
              ]
            }
          },
          lineStyle: { width: 3, color: '#3b82f6' },
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
  }, [sortedShifts, anomalies]);

  if (!isMounted) {
    return <div className="p-8 text-center text-slate-500 font-medium animate-pulse">Loading dashboard...</div>;
  }

  if (loading && !shifts.length) {
    return <div className="p-8 text-center text-slate-500 font-medium animate-pulse">Loading amazing things...</div>;
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 bg-slate-50 min-h-screen">
      {/* Main Content Area */}
      <div className="flex-1 space-y-6">
        
        {/* Header / Utility row */}
        <div className="flex justify-between items-center bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Dashboard Overview</h1>
            <p className="text-sm text-slate-500">Welcome back! Here is your latest performance.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadDashboard} className="px-4 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg text-sm hover:bg-indigo-100 transition">
              Refresh
            </button>
            <button className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg text-sm hover:bg-slate-800 transition">
              Export Report
            </button>
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">{error}</div>}
        
        {anomalies.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-red-50 text-red-800 rounded-lg border border-red-100">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <p className="text-sm font-semibold">Heads up! We detected {anomalies.length} anomal{anomalies.length > 1 ? 'ies' : 'y'} in your recent activity.</p>
          </div>
        )}

        {/* KPI Grid (4 Columns) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Net</div>
            <div className="text-2xl font-bold text-slate-800">PKR {kpis.net.toLocaleString()}</div>
          </div>
          <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Hourly Average</div>
            <div className="text-2xl font-bold text-slate-800">PKR {Math.round(kpis.hourly).toLocaleString()}</div>
          </div>
          <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Verified Shifts</div>
            <div className="text-2xl font-bold text-slate-800">{kpis.verified} / {kpis.shifts}</div>
          </div>
          <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Active Complaints</div>
            <div className="text-2xl font-bold text-slate-800">{complaints.filter(c => c.status !== 'resolved').length}</div>
          </div>
        </div>

        {/* Performance Chart Area */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-slate-800">Performance (Earnings & Alerts)</h2>
            <div className="flex bg-slate-100 rounded-lg p-1 text-xs font-medium">
              <button className="px-3 py-1 bg-white rounded shadow-sm text-slate-800">30 Days</button>
              <button className="px-3 py-1 text-slate-500 hover:text-slate-700">6 Months</button>
            </div>
          </div>
          <div className="h-64">
             {shifts.length > 0 ? (
               <ReactECharts option={performanceOption} style={{ height: '100%', width: '100%' }} />
             ) : (
               <div className="h-full flex items-center justify-center text-slate-400 text-sm">No performance data yet</div>
             )}
          </div>
        </div>

        {/* Current Tasks / Complaints List */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-base font-bold text-slate-800 mb-4">Current Tasks (Grievances)</h2>
          {complaints.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 bg-slate-50">
                    <th className="py-3 px-4 font-semibold rounded-tl-lg">Complaint ID</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold hidden md:table-cell">Platform</th>
                    <th className="py-3 px-4 font-semibold hidden lg:table-cell">Date</th>
                    <th className="py-3 px-4 font-semibold rounded-tr-lg">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {complaints.slice(0, 5).map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-medium text-slate-900">{c.id.split('-')[0].toUpperCase()}</td>
                      <td className="py-3 px-4 capitalize">{c.category.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-4 hidden md:table-cell capitalize flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.platform === 'uber' ? 'bg-black' : c.platform === 'foodpanda' ? 'bg-pink-500' : 'bg-emerald-500'}`}></span>
                        {c.platform}
                      </td>
                      <td className="py-3 px-4 text-slate-500 hidden lg:table-cell">
                        {formatDateLong(c.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold 
                          ${c.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 
                            c.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 
                            'bg-blue-100 text-blue-700'}`}>
                          {c.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {complaints.length > 5 && (
                <div className="pt-4 text-center">
                  <button className="text-sm text-indigo-600 font-semibold hover:underline">View All {complaints.length} Tasks</button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
              No current tasks or complaints active.
            </div>
          )}
        </div>

      </div>

      {/* Right Sidebar (Activity Tab) */}
      <div className="w-full xl:w-80 space-y-6">
        {/* User Card Mini Profile */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
            {context.workerId ? context.workerId.slice(0,2).toUpperCase() : 'FG'}
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Worker Profile</h3>
            <p className="text-xs text-slate-500 capitalize">{context.zone} &bull; {context.category.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex justify-between items-center">
            <span>Recent Earnings</span>
            <span className="bg-slate-100 text-slate-500 text-xs py-0.5 px-2 rounded-full">Activity</span>
          </h2>
          
          <div className="space-y-4">
            {sortedShifts.slice(0, 8).map((s, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <div className={`mt-1 w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white
                  ${s.platform === 'uber' ? 'bg-slate-900' : s.platform === 'foodpanda' ? 'bg-pink-500' : 'bg-emerald-600'}`}>
                  {s.platform.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <p className="text-sm font-bold text-slate-800 capitalize">{s.platform}</p>
                    <p className="text-sm font-bold text-emerald-600">+PKR {s.net_received}</p>
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <p className="text-xs text-slate-500">{formatRelativeTime(s.shift_date)}</p>
                    <p className="text-xs text-slate-400 font-medium">{s.hours_worked} hrs</p>
                  </div>
                </div>
              </div>
            ))}
            
            {sortedShifts.length === 0 && (
               <p className="text-sm text-slate-400 italic text-center py-4">No recent earnings available.</p>
            )}
          </div>
          
          {sortedShifts.length > 8 && (
            <button className="w-full mt-4 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition">
               View Full History
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
