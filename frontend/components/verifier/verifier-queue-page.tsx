'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Expand, Flag, Loader2, X, XCircle } from 'lucide-react';
import { API_BASE, authFetch } from '@/lib/api';

type QueueShift = {
  id: string;
  worker_name: string;
  platform: string;
  shift_date: string;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  screenshot_url?: string;
  file_url?: string;
  submitted_at?: string;
  created_at?: string;
};

type DecisionStatus = 'verified' | 'flagged' | 'unverifiable';

type ToastKind = 'success' | 'warning' | 'error';

type ToastState = {
  id: number;
  kind: ToastKind;
  message: string;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function normalizeQueueItem(raw: any): QueueShift {
  return {
    id: String(raw?.id || raw?.shift_id || ''),
    worker_name: String(raw?.worker_name || 'Unknown worker'),
    platform: String(raw?.platform || '—'),
    shift_date: String(raw?.shift_date || raw?.submitted_at || raw?.created_at || ''),
    gross_earned: Number(raw?.gross_earned || 0),
    platform_deductions: Number(raw?.platform_deductions || 0),
    net_received: Number(raw?.net_received || 0),
    screenshot_url: typeof raw?.screenshot_url === 'string' ? raw.screenshot_url : undefined,
    file_url: typeof raw?.file_url === 'string' ? raw.file_url : undefined,
    submitted_at: typeof raw?.submitted_at === 'string' ? raw.submitted_at : undefined,
    created_at: typeof raw?.created_at === 'string' ? raw.created_at : undefined,
  };
}

function resolveImage(url: string | undefined) {
  if (!url) return '';
  const raw = String(url).trim();
  if (!raw || raw === 'null' || raw === 'undefined') return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `${API_BASE.earnings}${raw}`;
  return `${API_BASE.earnings}/${raw.replace(/^\.\//, '')}`;
}

function imageCandidates(url: string | undefined) {
  const raw = String(url || '').trim();
  if (!raw || raw === 'null' || raw === 'undefined') return [];
  if (raw.startsWith('/uploads/') || raw.includes('earnings-service/uploads/')) return [];

  const base = API_BASE.earnings.replace(/\/$/, '');
  const candidates: string[] = [];

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    candidates.push(raw);
  } else {
    const cleaned = raw.replace(/^\.\//, '');
    candidates.push(`${base}/${cleaned.replace(/^\//, '')}`);

    if (cleaned.startsWith('/')) {
      candidates.push(`${base}${cleaned}`);
    }

    if (cleaned.includes('uploads/')) {
      const filename = cleaned.split('uploads/').pop() || '';
      if (filename) {
        candidates.push(`${base}/uploads/${filename}`);
      }
    }

    if (cleaned.includes('earnings-service/uploads/')) {
      const filename = cleaned.split('earnings-service/uploads/').pop() || '';
      if (filename) {
        candidates.push(`${base}/uploads/${filename}`);
      }
    }
  }

  const normalized = candidates
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace('///', '//'));

  return Array.from(new Set(normalized));
}

function formatDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatRupees(value: number) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
}

function QueueSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-52 animate-pulse rounded bg-slate-200" />
      <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const styleMap: Record<ToastKind, string> = {
    success: 'border-green-200 bg-green-50 text-green-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    error: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-md ${styleMap[toast.kind]}`}>
      <span>{toast.message}</span>
      <button type="button" onClick={onClose} className="inline-flex h-5 w-5 items-center justify-center rounded text-current/80">
        <X size={14} />
      </button>
    </div>
  );
}

export default function VerifierQueuePage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<QueueShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [submittingId, setSubmittingId] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState<DecisionStatus | ''>('');
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  const pushToast = (kind: ToastKind, message: string) => {
    setToast({ id: Date.now(), kind, message });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = async () => {
    try {
      setLoading(true);
      setError('');

      const queueRes = await authFetch(`${API_BASE.earnings}/verifier/queue`, { cache: 'no-store' });

      const queuePayload = await queueRes.json().catch(() => []);

      if (!queueRes.ok) {
        const detail = typeof queuePayload?.detail === 'string'
          ? queuePayload.detail
          : 'Could not load verifier queue';
        setError(detail);
        setItems([]);
        return;
      }

      const queueRows = Array.isArray(queuePayload)
        ? queuePayload.map((item) => normalizeQueueItem(item)).filter((item) => item.id)
        : [];

      const rows = [...queueRows].sort((a, b) => {
        const aTime = new Date(a.submitted_at || a.created_at || a.shift_date || '').getTime() || 0;
        const bTime = new Date(b.submitted_at || b.created_at || b.shift_date || '').getTime() || 0;
        return aTime - bTime;
      });

      setItems(rows);
    } catch {
      setError('Could not load verifier queue');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const platformOptions = useMemo(() => {
    const values = Array.from(new Set(items.map((item) => item.platform).filter(Boolean)));
    return ['all', ...values];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const query = search.trim().toLowerCase();
      const queryMatch =
        query.length === 0 ||
        item.worker_name.toLowerCase().includes(query) ||
        item.platform.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query);

      const platformMatch = platformFilter === 'all' || item.platform === platformFilter;

      const day = String(item.shift_date || '').slice(0, 10);
      const fromMatch = !fromDate || day >= fromDate;
      const toMatch = !toDate || day <= toDate;

      return queryMatch && platformMatch && fromMatch && toMatch;
    });
  }, [items, search, platformFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, platformFilter, fromDate, toDate, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const resetFilters = () => {
    setSearch('');
    setPlatformFilter('all');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const openPreview = (url: string | undefined) => {
    const normalized = resolveImage(url);
    if (!normalized) {
      pushToast('error', 'No screenshot URL found');
      return;
    }
    setScreenshotPreviewUrl(normalized);
  };

  const closePreview = () => {
    setScreenshotPreviewUrl('');
  };

  const decide = async (item: QueueShift, status: DecisionStatus) => {
    const verifierId = localStorage.getItem('fairgig_user_id') || '';
    if (!verifierId) {
      pushToast('error', 'Missing verifier profile. Please login again.');
      return;
    }

    setSubmittingId(item.id);
    setSubmittingStatus(status);

    const candidates = [
      {
        url: `${API_BASE.earnings}/verifier/queue/${item.id}/${status === 'flagged' ? 'flag' : status === 'verified' ? 'verify' : 'unverifiable'}`,
        method: 'POST',
        body: JSON.stringify({ verifier_id: verifierId }),
      },
      {
        url: `${API_BASE.earnings}/verifier/${item.id}/decision`,
        method: 'PUT',
        body: JSON.stringify({ status, verifier_id: verifierId }),
      },
    ];

    let success = false;
    let detail = '';

    for (const candidate of candidates) {
      const res = await authFetch(candidate.url, {
        method: candidate.method,
        body: candidate.body,
      });

      if (res.ok) {
        success = true;
        break;
      }

      try {
        const payload = await res.json();
        detail = typeof payload?.detail === 'string' ? payload.detail : detail;
      } catch {
        detail = detail || 'Request failed';
      }

      if (res.status !== 404) break;
    }

    if (!success) {
      pushToast('error', detail || 'Failed to save decision');
      setSubmittingId('');
      setSubmittingStatus('');
      return;
    }

    if (status === 'verified') pushToast('success', '✓ Marked as Verified');
    if (status === 'flagged') pushToast('warning', '⚑ Discrepancy Flagged');
    if (status === 'unverifiable') pushToast('error', '✗ Marked Unverifiable');

    setItems((previous) => previous.filter((row) => row.id !== item.id));
    setSubmittingId('');
    setSubmittingStatus('');
  };

  if (loading) return <QueueSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Verifier Queue</h1>
        <p className="text-sm text-slate-500">Pending items: {filteredItems.length}</p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-12">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-5"
          placeholder="Search by worker, platform, ID..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          value={platformFilter}
          onChange={(event) => setPlatformFilter(event.target.value)}
        >
          {platformOptions.map((option) => (
            <option key={option} value={option}>
              {option === 'all' ? 'All platforms' : option}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2 md:col-span-4">
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
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
              <th className="py-2">Worker</th>
              <th>Platform</th>
              <th>Date</th>
              <th>Gross</th>
              <th>Deductions</th>
              <th>Net</th>
              <th>Screenshot</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((item) => {
              const image = resolveImage(item.screenshot_url || item.file_url);
              const busy = submittingId === item.id;

              return (
                <tr key={item.id} className="border-b">
                  <td className="py-2 font-medium text-slate-900">{item.worker_name}</td>
                  <td>{item.platform}</td>
                  <td>{formatDateOnly(item.shift_date)}</td>
                  <td>{formatRupees(item.gross_earned)}</td>
                  <td>{formatRupees(item.platform_deductions)}</td>
                  <td className="font-semibold text-emerald-700">{formatRupees(item.net_received)}</td>
                  <td>
                    {image ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openPreview(item.screenshot_url || item.file_url)}
                          className="inline-flex rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => openPreview(item.screenshot_url || item.file_url)}
                          className="inline-flex rounded-lg border border-slate-300 p-1 text-slate-600 hover:bg-slate-50"
                          aria-label="Expand screenshot"
                        >
                          <Expand size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Not attached</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => void decide(item, 'verified')}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#16A34A] px-2 py-1 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-60"
                      >
                        {busy && submittingStatus === 'verified' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => void decide(item, 'flagged')}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#D97706] px-2 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                      >
                        {busy && submittingStatus === 'flagged' ? <Loader2 size={12} className="animate-spin" /> : <Flag size={12} />}
                        Flag
                      </button>
                      <button
                        type="button"
                        onClick={() => void decide(item, 'unverifiable')}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#DC2626] px-2 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                      >
                        {busy && submittingStatus === 'unverifiable' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                        Unverifiable
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!filteredItems.length ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-slate-500">
                  {items.length ? 'No queue items found for current filters.' : 'Queue empty — all items are reviewed.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {filteredItems.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
          >
            Next
          </button>
          </div>
        </div>
      ) : null}

      {mounted && screenshotPreviewUrl
        ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
            <button
              type="button"
              onClick={closePreview}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white"
              aria-label="Close screenshot preview"
            >
              <X size={18} />
            </button>
            <img
              src={screenshotPreviewUrl}
              alt="queue screenshot preview"
              className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
            />
          </div>,
          document.body,
        )
        : null}

      {toast ? (
        <div className="fixed bottom-4 right-4 z-[60] w-[min(360px,calc(100vw-2rem))]">
          <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
      ) : null}
    </div>
  );
}
