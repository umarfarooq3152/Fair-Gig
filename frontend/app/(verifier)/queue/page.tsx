'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

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

  const load = async () => {
    const res = await fetch(`${API_BASE.earnings}/verifier/queue`, { cache: 'no-store' });
    setItems(await res.json());
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id: string, status: 'verified' | 'flagged' | 'unverifiable') => {
    const verifierId = localStorage.getItem('fairgig_user_id');
    await fetch(`${API_BASE.earnings}/verifier/${id}/decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, verifier_id: verifierId }),
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Verifier Queue</h1>
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
