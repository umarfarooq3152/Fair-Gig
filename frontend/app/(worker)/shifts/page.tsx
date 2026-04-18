'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '@/lib/api';

type Shift = {
  id: string;
  platform: string;
  shift_date: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  verification_status: 'pending' | 'verified' | 'flagged' | 'unverifiable' | string;
  screenshot_url?: string | null;
  notes?: string | null;
};

type ShiftForm = {
  platform: string;
  shift_date: string;
  hours_worked: string;
  gross_earned: string;
  platform_deductions: string;
  net_received: string;
  notes: string;
};

const platformOptions = ['Careem', 'Bykea', 'foodpanda', 'Upwork', 'Other'];

function formatDateOnly(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatRupees(value: number) {
  return `Rs ${Number(value || 0).toLocaleString('en-PK')}`;
}

function statusClass(status: string) {
  if (status === 'verified') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
  if (status === 'flagged') return 'bg-rose-100 text-rose-700 border-rose-300';
  if (status === 'unverifiable') return 'bg-amber-100 text-amber-700 border-amber-300';
  return 'bg-blue-100 text-blue-700 border-blue-300';
}

function normalizeScreenshotUrl(url: string | null | undefined) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE.earnings}${url}`;
  return `${API_BASE.earnings}/${url}`;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ShiftForm>({
    platform: '',
    shift_date: '',
    hours_worked: '',
    gross_earned: '',
    platform_deductions: '',
    net_received: '',
    notes: '',
  });

  const resetForm = () => {
    setForm({
      platform: '',
      shift_date: '',
      hours_worked: '',
      gross_earned: '',
      platform_deductions: '',
      net_received: '',
      notes: '',
    });
    setEditingId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (shift: Shift) => {
    setEditingId(shift.id);
    setForm({
      platform: shift.platform || '',
      shift_date: String(shift.shift_date || '').slice(0, 10),
      hours_worked: String(shift.hours_worked ?? ''),
      gross_earned: String(shift.gross_earned ?? ''),
      platform_deductions: String(shift.platform_deductions ?? ''),
      net_received: String(shift.net_received ?? ''),
      notes: shift.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSaving(false);
    setError('');
    resetForm();
  };

  const load = async () => {
    setLoading(true);
    setError('');
    const workerId = localStorage.getItem('fairgig_user_id');
    if (!workerId) {
      setLoading(false);
      setError('Missing worker profile. Please login again.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE.earnings}/shifts?worker_id=${encodeURIComponent(workerId)}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.detail || 'Could not load shifts');
        setShifts([]);
        return;
      }
      setShifts(Array.isArray(payload) ? payload : []);
    } catch {
      setError('Could not connect to earnings service');
    } finally {
      setLoading(false);
    }
  };

  const submitShift = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const workerId = localStorage.getItem('fairgig_user_id');
    if (!workerId) {
      setError('Missing worker profile. Please login again.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      worker_id: workerId,
      platform: form.platform,
      shift_date: form.shift_date,
      hours_worked: Number(form.hours_worked || 0),
      gross_earned: Number(form.gross_earned || 0),
      platform_deductions: Number(form.platform_deductions || 0),
      net_received: Number(form.net_received || 0),
      notes: form.notes || null,
    };

    const url = editingId ? `${API_BASE.earnings}/shifts/${editingId}` : `${API_BASE.earnings}/shifts`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || `Could not ${editingId ? 'update' : 'create'} shift`);
        return;
      }

      closeModal();
      await load();
    } catch {
      setError(`Could not ${editingId ? 'update' : 'create'} shift`);
    } finally {
      setSaving(false);
    }
  };

  const deleteShift = async (id: string) => {
    const workerId = localStorage.getItem('fairgig_user_id');
    if (!workerId) {
      setError('Missing worker profile. Please login again.');
      return;
    }

    setDeletingId(id);
    setError('');
    try {
      const res = await fetch(`${API_BASE.earnings}/shifts/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: workerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not delete shift');
        return;
      }
      await load();
    } catch {
      setError('Could not delete shift');
    } finally {
      setDeletingId('');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredShifts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return shifts.filter((s) => {
      const matchesQuery = query.length === 0
        || s.platform.toLowerCase().includes(query)
        || String(s.id).toLowerCase().includes(query)
        || String(s.verification_status).toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'all' || s.verification_status === statusFilter;
      const matchesPlatform = platformFilter === 'all' || s.platform === platformFilter;

      const day = String(s.shift_date || '').slice(0, 10);
      const matchesFrom = !fromDate || day >= fromDate;
      const matchesTo = !toDate || day <= toDate;

      return matchesQuery && matchesStatus && matchesPlatform && matchesFrom && matchesTo;
    });
  }, [fromDate, platformFilter, search, shifts, statusFilter, toDate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800" onClick={openCreateModal}>
          Log New Shift
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-5">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          placeholder="Search by platform, ID, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
          <option value="all">All platforms</option>
          {platformOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="flagged">Flagged</option>
          <option value="unverifiable">Unverifiable</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredShifts.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="py-2">{s.platform}</td>
                <td>{formatDateOnly(s.shift_date)}</td>
                <td>{s.hours_worked}</td>
                <td>{formatRupees(s.gross_earned)}</td>
                <td>{formatRupees(s.platform_deductions)}</td>
                <td className="font-semibold text-emerald-700">{formatRupees(s.net_received)}</td>
                <td>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(s.verification_status)}`}>
                    {s.verification_status.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  {s.screenshot_url ? (
                    <a
                      href={normalizeScreenshotUrl(s.screenshot_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Not attached</span>
                  )}
                </td>
                <td>
                  {s.verification_status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(s)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void deleteShift(s.id)}
                        disabled={deletingId === s.id}
                        className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        {deletingId === s.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Locked</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && filteredShifts.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-sm text-slate-500">
                  No shifts found for current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Shift' : 'Log New Shift'}</h2>
              <button onClick={closeModal} className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">Close</button>
            </div>

            <form className="grid gap-3 md:grid-cols-2" onSubmit={submitShift}>
              <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.platform} onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))} required>
                <option value="" disabled>Select platform</option>
                {platformOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={form.shift_date} onChange={(e) => setForm((prev) => ({ ...prev, shift_date: e.target.value }))} required />

              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" step="0.1" min="0" placeholder="Hours worked (e.g. 8)" value={form.hours_worked} onChange={(e) => setForm((prev) => ({ ...prev, hours_worked: e.target.value }))} required />
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" min="0" placeholder="Gross earned in Rs (e.g. 2500)" value={form.gross_earned} onChange={(e) => setForm((prev) => ({ ...prev, gross_earned: e.target.value }))} required />

              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" min="0" placeholder="Deductions in Rs (e.g. 500)" value={form.platform_deductions} onChange={(e) => setForm((prev) => ({ ...prev, platform_deductions: e.target.value }))} required />
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" min="0" placeholder="Net received in Rs (e.g. 2000)" value={form.net_received} onChange={(e) => setForm((prev) => ({ ...prev, net_received: e.target.value }))} required />

              <textarea className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" rows={3} placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />

              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70">
                  {saving ? (editingId ? 'Saving...' : 'Logging...') : (editingId ? 'Save Changes' : 'Log Shift')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
