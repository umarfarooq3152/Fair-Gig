'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { API_BASE, authFetch } from '@/lib/api';

type Shift = {
  id?: string;
  shift_date?: string;
  platform: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  verification_status: string;
};

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getStartOfCurrentMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function formatDateOnly(value?: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function normalizeShiftList(payload: unknown): Shift[] {
  if (Array.isArray(payload)) return payload as Shift[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Shift[];
    if (Array.isArray(obj.shifts)) return obj.shifts as Shift[];
    if (Array.isArray(obj.items)) return obj.items as Shift[];
    if (Array.isArray(obj.rows)) return obj.rows as Shift[];
  }
  return [];
}

function isVerifiedLike(statusRaw: string) {
  const status = String(statusRaw || '').toLowerCase().trim();
  return status.includes('verif') || status.includes('approv');
}

function inDateRange(dateLike: string | undefined, from: string, to: string) {
  if (!dateLike) return false;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return false;
  const day = d.toISOString().slice(0, 10);
  return day >= from && day <= to;
}

export default function CertificatePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(getStartOfCurrentMonthIso());
  const [to, setTo] = useState(getTodayIso());
  const [profile, setProfile] = useState({
    name: 'Worker',
    id: '',
    category: '',
    zone: '',
  });

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const workerId = localStorage.getItem('fairgig_user_id');
      if (!workerId) {
        setShifts([]);
        setLoading(false);
        return;
      }

      setProfile({
        name: localStorage.getItem('fairgig_user_name') || 'Worker',
        id: localStorage.getItem('fairgig_user_id') || '',
        category: localStorage.getItem('fairgig_category') || '',
        zone: localStorage.getItem('fairgig_city_zone') || '',
      });

      try {
        const res = await authFetch(`${API_BASE.earnings}/shifts?worker_id=${encodeURIComponent(workerId)}`);
        const payload = await res.json().catch(() => []);
        const rows = normalizeShiftList(payload);
        const approvedRows = rows.filter((s: Shift) => isVerifiedLike(s.verification_status) && inDateRange(s.shift_date, from, to));
        setShifts(
          approvedRows.sort((a, b) => {
            const ad = new Date(a.shift_date || '').getTime();
            const bd = new Date(b.shift_date || '').getTime();
            return bd - ad;
          }),
        );
      } catch {
        setShifts([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [from, to]);

  const summary = useMemo(() => {
    const byPlatform = new Map<string, { shifts: number; gross: number; deductions: number; net: number }>();
    let totalHours = 0;
    let totalNet = 0;

    for (const s of shifts) {
      const prev = byPlatform.get(s.platform) || { shifts: 0, gross: 0, deductions: 0, net: 0 };
      prev.shifts += 1;
      prev.gross += Number(s.gross_earned);
      prev.deductions += Number(s.platform_deductions);
      prev.net += Number(s.net_received);
      byPlatform.set(s.platform, prev);
      totalHours += Number(s.hours_worked);
      totalNet += Number(s.net_received);
    }

    return {
      rows: Array.from(byPlatform.entries()).map(([platform, data]) => ({ platform, ...data })),
      totalHours,
      totalNet,
      avgHourly: totalHours > 0 ? totalNet / totalHours : 0,
    };
  }, [shifts]);

  const verificationId = useMemo(() => {
    if (!profile.id) return '';
    const safeFrom = from.replace(/-/g, '');
    const safeTo = to.replace(/-/g, '');
    return `CERT-${profile.id.substring(0, 8).toUpperCase()}-${safeFrom}-${safeTo}`;
  }, [profile.id, from, to]);

  const verifyUrl = typeof window !== 'undefined' ? `${window.location.origin}/verify/${verificationId}` : '';

  if (loading) {
    return (
      <div className="fixed inset-0 z-[210] flex items-center justify-center bg-white/35 backdrop-blur-sm">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card no-print flex items-end gap-3 action-buttons">
        <div>
          <label className="mb-1 block text-sm">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn" onClick={() => window.print()}>Print Certificate</button>
      </div>

      <div className="certificate-container mx-auto max-w-4xl rounded-lg border border-gray-300 bg-white p-8 shadow">
        <div className="mb-6 flex justify-between border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold">FairGig</h1>
            <p className="text-sm text-green-700">VERIFIED INCOME CERTIFICATE</p>
          </div>
          {verificationId && (
            <div className="flex flex-col items-center">
              <div className="bg-white p-1 pb-0">
                <QRCode value={verifyUrl} size={80} />
              </div>
              <p className="mt-1 text-[10px] text-gray-500">Scan to Verify</p>
              <p className="text-[9px] text-gray-400">{verificationId}</p>
            </div>
          )}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <p>Worker: {profile.name}</p>
          <p>ID: {profile.id}</p>
          <p>Category: {profile.category}</p>
          <p>Zone: {profile.zone}</p>
          <p className="md:col-span-2">Period: {from} to {to}</p>
        </div>

        <table className="mb-6 w-full border text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Platform</th>
              <th className="p-2 text-left">Hours</th>
              <th className="p-2 text-left">Gross</th>
              <th className="p-2 text-left">Deduct</th>
              <th className="p-2 text-left">Net</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((row, idx) => (
              <tr key={row.id || `${row.platform}-${row.shift_date || idx}`} className="border-b">
                <td className="p-2">{formatDateOnly(row.shift_date)}</td>
                <td className="p-2">{row.platform}</td>
                <td className="p-2">{Number(row.hours_worked || 0).toFixed(1)}</td>
                <td className="p-2">Rs. {Number(row.gross_earned || 0).toFixed(0)}</td>
                <td className="p-2">Rs. {Number(row.platform_deductions || 0).toFixed(0)}</td>
                <td className="p-2">Rs. {Number(row.net_received || 0).toFixed(0)}</td>
              </tr>
            ))}
            {shifts.length === 0 ? (
              <tr>
                <td className="p-3 text-sm text-gray-500" colSpan={6}>No verified entries found in selected period.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="space-y-2 border-t pt-4">
          <p className="text-lg font-bold">TOTAL VERIFIED NET INCOME: Rs. {summary.totalNet.toFixed(0)}</p>
          <p>Total Hours: {summary.totalHours.toFixed(1)} hrs | Avg: Rs.{summary.avgHourly.toFixed(0)}/hr</p>
          <div className="mt-4 flex flex-col sm:flex-row justify-between text-xs text-gray-500 gap-2">
            <p>Generated by FairGig | Not a legal document</p>
            {verificationId && <p>Certificate ID: <strong className="text-slate-700">{verificationId}</strong></p>}
          </div>
        </div>
      </div>
    </div>
  );
}
