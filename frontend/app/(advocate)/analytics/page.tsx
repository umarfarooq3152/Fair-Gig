'use client';

import { useEffect, useState } from 'react';
import {
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

export default function AdvocateAnalyticsPage() {
  const [commission, setCommission] = useState<any[]>([]);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const run = async () => {
      const [a, b, c, d] = await Promise.all([
        fetch(`${API_BASE.analytics}/analytics/commission-trends`).then((r) => r.json()),
        fetch(`${API_BASE.analytics}/analytics/income-distribution`).then((r) => r.json()),
        fetch(`${API_BASE.analytics}/analytics/top-complaints`).then((r) => r.json()),
        fetch(`${API_BASE.analytics}/analytics/vulnerability-flags`).then((r) => r.json()),
      ]);
      setCommission(a);
      const distPayload = b && typeof b === 'object' && 'zones' in b ? (b as { zones: unknown[] }).zones : b;
      setDistribution(Array.isArray(distPayload) ? distPayload : []);
      setComplaints(c);
      setFlags(d);
    };
    run();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Advocate Analytics Panel</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card h-80">
          <p className="mb-3 text-sm font-medium">Commission Rate Trends</p>
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={commission}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line dataKey="avg_rate" stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </div>

        <div className="card h-80">
          <p className="mb-3 text-sm font-medium">Income Distribution by Zone</p>
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="zone" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="bucket_0_20k" fill="#60a5fa" />
                <Bar dataKey="bucket_20_40k" fill="#34d399" />
                <Bar dataKey="bucket_40_60k" fill="#f59e0b" />
                <Bar dataKey="bucket_60k_plus" fill="#f87171" />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>

        <div className="card h-80">
          <p className="mb-3 text-sm font-medium">Top Complaint Categories</p>
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={complaints} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="category" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#a855f7" />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>

        <div className="card h-80 overflow-auto">
          <p className="mb-3 text-sm font-medium">Vulnerability Flags</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Worker</th>
                <th>Zone</th>
                <th>Current</th>
                <th>Previous</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={String(f.id)} className="border-b">
                  <td className="py-2">{f.name}</td>
                  <td>{f.city_zone}</td>
                  <td>
                    <span className="rounded bg-red-100 px-2 py-1 text-red-700">{f.current_month}</span>
                  </td>
                  <td>{f.previous_month}</td>
                  <td>
                    {f.drop_percentage != null ? (
                      <span className="text-xs font-semibold text-amber-800">{f.drop_percentage}% drop</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
