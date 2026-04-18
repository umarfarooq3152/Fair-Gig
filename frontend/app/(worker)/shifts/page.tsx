'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_BASE, authFetch } from '@/lib/api';

type Shift = {
  id: string;
  platform: string;
  shift_date: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  verification_status: string;
};

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);

  const uploadScreenshot = async (shiftId: string, file: File | null) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    await authFetch(`${API_BASE.earnings}/shifts/${shiftId}/screenshot`, {
      method: 'POST',
      body: formData,
    });
    await load();
  };

  const load = async () => {
    const workerId = localStorage.getItem('fairgig_user_id');
    if (!workerId) return;
    const res = await authFetch(`${API_BASE.earnings}/shifts?worker_id=${workerId}`);
    const data = await res.json();
    setShifts(res.ok && Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <Link href="/shifts/new" className="btn">Log New Shift</Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Platform</th>
              <th>Date</th>
              <th>Hours</th>
              <th>Gross</th>
              <th>Deductions</th>
              <th>Net</th>
              <th>Status</th>
              <th>Screenshot</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="py-2">{s.platform}</td>
                <td>{s.shift_date}</td>
                <td>{s.hours_worked}</td>
                <td>{s.gross_earned}</td>
                <td>{s.platform_deductions}</td>
                <td>{s.net_received}</td>
                <td>{s.verification_status}</td>
                <td>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => uploadScreenshot(s.id, e.target.files?.[0] || null)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
