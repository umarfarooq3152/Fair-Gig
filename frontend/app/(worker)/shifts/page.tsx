'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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

type CsvPreviewRow = {
  id: number;
  platform: string;
  shift_date: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  notes: string;
  screenshotFile: File | null;
  include: boolean;
  issue: string;
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

function parseCsvLine(line: string, delimiter: string) {
  const escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cells = line.split(new RegExp(`${escaped}(?=(?:[^"]*"[^"]*")*[^"]*$)`));
  return cells.map((cell) => cell.trim().replace(/^"|"$/g, '').trim());
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, '_');
}

const headerAliases: Record<string, string[]> = {
  platform: ['platform', 'app', 'company'],
  shift_date: ['shift_date', 'date', 'shiftdate', 'shift_date(yyyy-mm-dd)', 'shift_date_dd/mm/yyyy'],
  hours_worked: ['hours_worked', 'hours', 'hoursworked', 'worked_hours'],
  gross_earned: ['gross_earned', 'gross', 'gross_amount', 'gross_rs'],
  platform_deductions: ['platform_deductions', 'deductions', 'commission', 'platform_fee', 'deduction_rs'],
  notes: ['notes', 'note', 'remarks', 'comment'],
};

function findHeaderIndex(headers: string[], canonical: keyof typeof headerAliases) {
  const aliases = headerAliases[canonical].map(normalizeHeader);
  return headers.findIndex((h) => aliases.includes(normalizeHeader(h)));
}

function toNumber(value: string) {
  const n = Number(String(value || '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function parseDateOnly(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Excel serial date support.
  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    const utcDays = Math.floor(serial - 25569);
    const utcMs = utcDays * 86400 * 1000;
    const d = new Date(utcMs);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const normalized = raw.replace(/[.]/g, '/').replace(/-/g, '/');
  const parts = normalized.split('/').map((p) => p.trim());
  if (parts.length === 3) {
    // YYYY/MM/DD
    if (/^\d{4}$/.test(parts[0])) {
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      const d = Number(parts[2]);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    // DD/MM/YYYY or MM/DD/YYYY (best effort)
    if (/^\d{4}$/.test(parts[2])) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      const y = Number(parts[2]);

      let day = a;
      let month = b;
      if (b > 12 && a <= 12) {
        day = b;
        month = a;
      }

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${String(y).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

export default function ShiftsPage() {
  const [mounted, setMounted] = useState(false);
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
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvPreviewRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvMessage, setCsvMessage] = useState('');

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
    setProofFile(null);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPlatformFilter('all');
    setFromDate('');
    setToDate('');
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openCsvModal = () => {
    setCsvRows([]);
    setCsvFileName('');
    setCsvMessage('');
    setShowCsvModal(true);
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

  const closeCsvModal = () => {
    setShowCsvModal(false);
    setCsvUploading(false);
    setCsvMessage('');
  };

  const grossNum = Number(form.gross_earned || 0);
  const deductionsNum = Number(form.platform_deductions || 0);
  const calculatedNet = Math.max(0, Number((grossNum - deductionsNum).toFixed(2)));

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

    if (!editingId && !proofFile) {
      setError('Please attach screenshot proof before logging a shift.');
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
      net_received: calculatedNet,
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

      const shiftId = String(data?.id || editingId || '');
      if (proofFile && shiftId) {
        const formData = new FormData();
        formData.append('file', proofFile);
        const screenshotRes = await fetch(`${API_BASE.earnings}/shifts/${shiftId}/screenshot`, {
          method: 'POST',
          body: formData,
        });

        if (!screenshotRes.ok) {
          const screenshotPayload = await screenshotRes.json().catch(() => ({}));
          setError(screenshotPayload?.detail || 'Shift saved but screenshot upload failed. Please try edit and upload again.');
          await load();
          return;
        }
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

  const handleCsvSelect = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    if (lines.length < 2) {
      setError('CSV must include a header row and at least one data row.');
      setCsvRows([]);
      return;
    }

    const headerLine = lines[0].replace(/^\uFEFF/, '');
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;
    const delimiter = tabCount > semicolonCount && tabCount > commaCount ? '\t' : semicolonCount > commaCount ? ';' : ',';

    const headers = parseCsvLine(headerLine, delimiter).map((h) => String(h || ''));
    const requiredCanonical: Array<keyof typeof headerAliases> = ['platform', 'shift_date', 'hours_worked', 'gross_earned', 'platform_deductions'];
    const indexMap: Record<string, number> = {
      platform: findHeaderIndex(headers, 'platform'),
      shift_date: findHeaderIndex(headers, 'shift_date'),
      hours_worked: findHeaderIndex(headers, 'hours_worked'),
      gross_earned: findHeaderIndex(headers, 'gross_earned'),
      platform_deductions: findHeaderIndex(headers, 'platform_deductions'),
      notes: findHeaderIndex(headers, 'notes'),
    };

    const missing = requiredCanonical.filter((key) => indexMap[key] === -1);
    if (missing.length > 0) {
      setError(`CSV missing required columns: ${missing.join(', ')}`);
      setCsvRows([]);
      return;
    }

    const rows: CsvPreviewRow[] = lines.slice(1).map((line, index) => {
      const values = parseCsvLine(line, delimiter);
      const getCell = (key: keyof typeof indexMap) => {
        const idx = indexMap[key];
        return idx >= 0 ? (values[idx] || '') : '';
      };

      const rawDate = getCell('shift_date');
      const parsedDate = parseDateOnly(rawDate);
      const gross = toNumber(getCell('gross_earned') || '0');
      const deductions = toNumber(getCell('platform_deductions') || '0');
      const net = Math.max(0, Number((gross - deductions).toFixed(2)));

      const issueList: string[] = [];
      if (!parsedDate) issueList.push(`Invalid date: ${rawDate || 'empty'}`);
      if (!getCell('platform')) issueList.push('Missing platform');
      if (toNumber(getCell('hours_worked')) <= 0) issueList.push('Hours must be greater than 0');

      return {
        id: index + 1,
        platform: getCell('platform') || 'Other',
        shift_date: parsedDate || String(rawDate || ''),
        hours_worked: toNumber(getCell('hours_worked') || '0'),
        gross_earned: gross,
        platform_deductions: deductions,
        net_received: net,
        notes: getCell('notes') || '',
        screenshotFile: null,
        include: issueList.length === 0,
        issue: issueList.join(' | '),
      };
    });

    setCsvFileName(file.name);
    setCsvRows(rows);
    setCsvMessage('');
    setError('');
  };

  const setCsvRowImage = (rowId: number, file: File | null) => {
    setCsvRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, screenshotFile: file } : row)));
  };

  const toggleCsvRow = (rowId: number, include: boolean) => {
    setCsvRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, include } : row)));
  };

  const uploadCsvRowsWithPictures = async () => {
    if (csvUploading) return;
    const workerId = localStorage.getItem('fairgig_user_id');
    if (!workerId) {
      setError('Missing worker profile. Please login again.');
      return;
    }

    const selected = csvRows.filter((row) => row.include && row.screenshotFile && !row.issue);
    if (selected.length === 0) {
      setCsvMessage('Attach screenshot to at least one row to enable bulk upload.');
      return;
    }

    setCsvUploading(true);
    setCsvMessage('');
    setError('');

    let successCount = 0;
    const failed: string[] = [];

    for (const row of selected) {
      try {
        const createRes = await fetch(`${API_BASE.earnings}/shifts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worker_id: workerId,
            platform: row.platform,
            shift_date: row.shift_date,
            hours_worked: row.hours_worked,
            gross_earned: row.gross_earned,
            platform_deductions: row.platform_deductions,
            net_received: row.net_received,
            notes: row.notes || null,
          }),
        });

        const created = await createRes.json().catch(() => ({}));
        if (!createRes.ok || !created?.id) {
          failed.push(`Row ${row.id}`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', row.screenshotFile as File);
        const screenshotRes = await fetch(`${API_BASE.earnings}/shifts/${created.id}/screenshot`, {
          method: 'POST',
          body: formData,
        });

        if (!screenshotRes.ok) {
          failed.push(`Row ${row.id}`);
          continue;
        }

        successCount += 1;
      } catch {
        failed.push(`Row ${row.id}`);
      }
    }

    if (failed.length === 0) {
      setCsvMessage(`Uploaded ${successCount} row(s) successfully.`);
    } else {
      setCsvMessage(`Uploaded ${successCount} row(s). Failed: ${failed.join(', ')}`);
    }

    await load();
    setCsvUploading(false);
  };

  useEffect(() => {
    setMounted(true);
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
        <div className="flex gap-2">
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={openCsvModal}>
            .CSV Import
          </button>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800" onClick={openCreateModal}>
            Log New Shift
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-12">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-4"
          placeholder="Search by platform, ID, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
          <option value="all">All platforms</option>
          {platformOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="flagged">Flagged</option>
          <option value="unverifiable">Unverifiable</option>
        </select>
        <div className="grid grid-cols-2 gap-2 md:col-span-3">
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:col-span-1"
        >
          Reset
        </button>
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

      {showModal && mounted
        ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
              <h2 className="text-xl font-bold">{editingId ? 'Edit Shift' : 'Log New Shift'}</h2>
              <button onClick={closeModal} className="rounded border border-slate-200/40 px-2 py-1 text-sm text-white hover:bg-white/10">Close</button>
            </div>

            <form className="grid gap-3 p-6 md:grid-cols-2" onSubmit={submitShift}>
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
              <input className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700" type="number" step="0.01" min="0" placeholder="Net received (auto-calculated)" value={calculatedNet} readOnly />

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Screenshot Proof {editingId ? '(optional)' : '(required)'}</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  required={!editingId}
                />
                {editingId ? (
                  <p className="mt-1 text-xs text-slate-500">Attach a file only if you want to replace current proof.</p>
                ) : null}
              </div>

              <textarea className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" rows={3} placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />

              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70">
                  {saving ? (editingId ? 'Saving...' : 'Logging...') : (editingId ? 'Save Changes' : 'Log Shift')}
                </button>
              </div>
            </form>
          </div>
          </div>,
          document.body,
        )
        : null}

      {showCsvModal && mounted
        ? createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
              <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
                <h2 className="text-xl font-bold">CSV Import With Proof Images</h2>
                <button onClick={closeCsvModal} className="rounded border border-slate-200/40 px-2 py-1 text-sm text-white hover:bg-white/10">Close</button>
              </div>

              <div className="space-y-4 p-6">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold">CSV Required Columns</p>
                  <p className="mt-1">Use columns exactly like this table format: <span className="font-mono">platform, shift_date, hours_worked, gross_earned, platform_deductions, notes(optional)</span>.</p>
                </div>

                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => void handleCsvSelect(e.target.files?.[0] || null)}
                />

                {csvFileName ? <p className="text-sm text-slate-600">Loaded file: <span className="font-semibold">{csvFileName}</span></p> : null}

                <div className="max-h-[45vh] overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b text-left">
                        <th className="px-3 py-2">Use</th>
                        <th className="px-3 py-2">Platform</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Hours</th>
                        <th className="px-3 py-2">Gross</th>
                        <th className="px-3 py-2">Deductions</th>
                        <th className="px-3 py-2">Net</th>
                        <th className="px-3 py-2">Proof Image</th>
                        <th className="px-3 py-2">Issue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={row.include} onChange={(e) => toggleCsvRow(row.id, e.target.checked)} />
                          </td>
                          <td className="px-3 py-2">{row.platform}</td>
                          <td className="px-3 py-2">{row.shift_date}</td>
                          <td className="px-3 py-2">{row.hours_worked}</td>
                          <td className="px-3 py-2">{formatRupees(row.gross_earned)}</td>
                          <td className="px-3 py-2">{formatRupees(row.platform_deductions)}</td>
                          <td className="px-3 py-2 font-semibold text-emerald-700">{formatRupees(row.net_received)}</td>
                          <td className="px-3 py-2">
                            <input
                              className="w-full text-xs"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => setCsvRowImage(row.id, e.target.files?.[0] || null)}
                              disabled={!row.include}
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-rose-700">{row.issue || '-'}</td>
                        </tr>
                      ))}
                      {csvRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                            Select CSV to preview rows here.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                {csvMessage ? <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{csvMessage}</p> : null}

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={closeCsvModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                  <button
                    type="button"
                    onClick={() => void uploadCsvRowsWithPictures()}
                    disabled={csvUploading || !csvRows.some((row) => row.include && row.screenshotFile)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {csvUploading ? 'Uploading...' : 'Upload All Selected With Pictures'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
