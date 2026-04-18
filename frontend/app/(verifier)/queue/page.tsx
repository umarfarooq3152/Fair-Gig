'use client';

import { useEffect, useState } from 'react';
import { API_BASE, authFetch } from '@/lib/api';

type QueueShift = {
  id: string;
  worker_name: string;
  platform: string;
  shift_date: string;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  screenshot_url: string;
};

export default function VerifierQueuePage() {
  const [items, setItems] = useState<QueueShift[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setError('');
    setLoading(true);
    const res = await authFetch(`${API_BASE.earnings}/verifier/queue`);
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data?.detail === 'string' ? data.detail : 'Could not load queue');
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id: string, status: 'verified' | 'flagged' | 'unverifiable') => {
    await authFetch(`${API_BASE.earnings}/verifier/${id}/decision`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Verifier Queue</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading queue…</p> : null}
      {!loading && items.length === 0 && !error ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-600">
          No pending shifts with screenshots. You&apos;re all caught up.
        </p>
      ) : null}
      {items.map((shift) => (
        <div key={shift.id} className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p><b>Worker:</b> {shift.worker_name}</p>
            <p><b>Platform:</b> {shift.platform}</p>
            <p><b>Date:</b> {shift.shift_date}</p>
            <p><b>Gross:</b> {shift.gross_earned}</p>
            <p><b>Deductions:</b> {shift.platform_deductions}</p>
            <p><b>Net:</b> {shift.net_received}</p>
          </div>
          <div>
            <img className="mb-3 w-full rounded border" src={`${API_BASE.earnings}${shift.screenshot_url}`} alt="uploaded screenshot" />
            <div className="flex gap-2">
              <button className="btn" onClick={() => decide(shift.id, 'verified')}>Verify</button>
              <button className="btn-outline" onClick={() => decide(shift.id, 'flagged')}>Flag Discrepancy</button>
              <button className="btn-outline" onClick={() => decide(shift.id, 'unverifiable')}>Unverifiable</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
