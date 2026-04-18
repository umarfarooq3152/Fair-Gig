'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API_BASE } from '@/lib/api';

type Shift = {
  id: string;
  platform: string;
  shift_date: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
};

export default function WorkerDashboardPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [anomaly, setAnomaly] = useState<any>({ anomalies: [], risk_score: 0, summary: '' });
  const [median, setMedian] = useState(0);

  useEffect(() => {
    const run = async () => {
      const workerId = localStorage.getItem('fairgig_user_id');
      const zone = localStorage.getItem('fairgig_city_zone') || 'DHA';
      const category = localStorage.getItem('fairgig_category') || 'ride_hailing';
      if (!workerId) return;

      const shiftsRes = await fetch(`${API_BASE.earnings}/shifts?worker_id=${workerId}`, { cache: 'no-store' });
      const shiftsData = await shiftsRes.json();
      setShifts(shiftsData);

      const anomalyRes = await fetch(`${API_BASE.anomaly}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: workerId, earnings: shiftsData.slice(0, 180) }),
      });
      setAnomaly(await anomalyRes.json());

      const medianRes = await fetch(`${API_BASE.analytics}/analytics/median/${category}/${zone}`, { cache: 'no-store' });
      const medianData = await medianRes.json();
      setMedian(medianData.median_hourly || 0);
    };
    run();
  }, []);

  const weekly = useMemo(() => {
    const map = new Map<string, { week: string; net: number; hours: number; gross: number; deductions: number }>();
    for (const s of shifts) {
      const week = s.shift_date.slice(0, 7);
      const prev = map.get(week) || { week, net: 0, hours: 0, gross: 0, deductions: 0 };
      prev.net += Number(s.net_received);
      prev.hours += Number(s.hours_worked);
      prev.gross += Number(s.gross_earned);
      prev.deductions += Number(s.platform_deductions);
      map.set(week, prev);
    }
    return Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
  }, [shifts]);

  const byPlatform = useMemo(() => {
    const map = new Map<string, { platform: string; commission: number }>();
    for (const s of shifts) {
      const gross = Number(s.gross_earned) || 0;
      if (gross <= 0) continue;
      const rate = Number(s.platform_deductions) / gross;
      const prev = map.get(s.platform) || { platform: s.platform, commission: 0 };
      prev.commission += rate;
      map.set(s.platform, prev);
    }
    return Array.from(map.values()).map((r) => ({ ...r, commission: Number((r.commission * 100).toFixed(1)) }));
  }, [shifts]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Worker Dashboard</h1>

      {anomaly.anomalies?.length ? (
        <div className="card border-red-300 bg-red-50">
          <p className="font-semibold text-red-700">Anomaly Alerts (Risk Score: {anomaly.risk_score})</p>
          {anomaly.anomalies.map((a: any, i: number) => (
            <p key={i} className="mt-1 text-sm">{a.type}: {a.explanation}</p>
          ))}
        </div>
      ) : (
        <div className="card"><p className="text-sm">No anomalies detected.</p></div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card h-72">
          <p className="mb-3 text-sm font-medium">Weekly/Monthly Earnings</p>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Area dataKey="net" stroke="#2563eb" fill="#93c5fd" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card h-72">
          <p className="mb-3 text-sm font-medium">Effective Hourly Rate Trend</p>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={weekly.map((w) => ({ ...w, hourly: w.hours ? Number((w.net / w.hours).toFixed(2)) : 0 }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Line dataKey="hourly" stroke="#16a34a" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card h-72">
          <p className="mb-3 text-sm font-medium">Platform Commission Tracker</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={byPlatform}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="platform" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="commission" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card h-72">
          <p className="mb-3 text-sm font-medium">City Median Comparison</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart
              data={[
                {
                  label: 'You',
                  value: weekly.length ? Number((weekly.reduce((a, b) => a + b.net, 0) / Math.max(weekly.reduce((a, b) => a + b.hours, 0), 1)).toFixed(2)) : 0,
                },
                { label: 'City Median', value: median },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
