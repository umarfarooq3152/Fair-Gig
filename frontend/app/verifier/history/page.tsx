'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, X } from 'lucide-react';
import { API_BASE, authFetch } from '@/lib/api';

type HistoryItem = {
  id: string;
  worker_name: string;
  platform: string;
  shift_date: string;
  gross_earned: number;
  net_received: number;
  action_taken: 'verified' | 'flagged' | 'unverifiable';
  reviewed_at: string;
  screenshot_url: string;
};

type ActionFilter = 'all' | 'verified' | 'flagged' | 'unverifiable';

const PAGE_SIZE = 10;

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function statusBadge(status: string) {
  if (status === 'verified') return 'bg-green-100 text-green-700';
  if (status === 'flagged') return 'bg-amber-100 text-amber-700';
  if (status === 'unverifiable') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
}

function resolveImage(url: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE.earnings}${url}`;
  return url;
}

function normalizeAction(value: unknown): 'verified' | 'flagged' | 'unverifiable' {
  const status = String(value || '').toLowerCase();
  if (status === 'flagged') return 'flagged';
  if (status === 'unverifiable') return 'unverifiable';
  return 'verified';
}

function mapAnyRowToHistory(row: any): HistoryItem {
  return {
    id: String(row?.id || row?.shift_id || row?.history_id || ''),
    worker_name: String(row?.worker_name || row?.worker?.name || row?.name || 'Unknown worker'),
    platform: String(row?.platform || '—'),
    shift_date: String(row?.shift_date || row?.submitted_at || row?.created_at || row?.date_submitted || ''),
    gross_earned: Number(row?.gross_earned || row?.gross || 0),
    net_received: Number(row?.net_received || row?.net || 0),
    action_taken: normalizeAction(row?.action_taken || row?.new_status || row?.verification_status),
    reviewed_at: String(row?.reviewed_at || row?.decided_at || row?.verified_at || row?.updated_at || row?.created_at || ''),
    screenshot_url: String(row?.screenshot_url || row?.file_url || row?.screenshot || ''),
  };
}

function sortByReviewedAt(rows: HistoryItem[]) {
  return rows.slice().sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime());
}

function toCsv(rows: HistoryItem[]) {
  const headers = [
    '#',
    'Worker Name',
    'Platform',
    'Date Submitted',
    'Gross',
    'Net',
    'Action Taken',
    'Reviewed At',
    'Screenshot',
  ];

  const escaped = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

  const lines = [headers.map(escaped).join(',')];
  rows.forEach((row, index) => {
    lines.push(
      [
        index + 1,
        row.worker_name,
        row.platform,
        row.shift_date,
        row.gross_earned,
        row.net_received,
        row.action_taken,
        row.reviewed_at,
        row.screenshot_url,
      ]
        .map(escaped)
        .join(','),
    );
  });

  return lines.join('\n');
}

function HistorySkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-10 w-44 animate-pulse rounded bg-slate-200" />
        <div className="h-10 w-40 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="mb-2 h-10 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export default function VerifierHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<ActionFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [previewImage, setPreviewImage] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');

      const meRes = await authFetch(`${API_BASE.auth}/me`, { cache: 'no-store' });
      const mePayload = meRes.ok ? await meRes.json() : null;
      const verifierId = String(mePayload?.id || localStorage.getItem('fairgig_user_id') || '');

      const historyCandidates = [
        `/api/verifier/history?page=1&limit=200`,
        `${API_BASE.earnings}/verifier/history?page=1&limit=200`,
      ];

      let endpointRows: any[] = [];
      for (const url of historyCandidates) {
        const historyRes = await authFetch(url, { cache: 'no-store' });
        if (!historyRes.ok) {
          if (historyRes.status === 404) continue;
          break;
        }

        const payload = await historyRes.json();
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload?.results)
                ? payload.results
                : [];

        if (rows.length) {
          endpointRows = rows;
          break;
        }
      }

      if (endpointRows.length) {
        const mapped = sortByReviewedAt(endpointRows.map((row) => mapAnyRowToHistory(row)).filter((row) => row.id));
        setItems(mapped);
        setPage(1);
        return;
      }

      const res = await authFetch(`${API_BASE.earnings}/shifts`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.detail === 'string' ? data.detail : 'Failed to load history');
        setItems([]);
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      const filteredRows = rows.filter((row: any) => {
        const status = String(row?.verification_status || '').toLowerCase();
        if (status === 'pending') return false;

        const rowVerifierId = String(row?.verifier_id || '');
        if (verifierId && rowVerifierId) return rowVerifierId === verifierId;
        if (verifierId && !rowVerifierId) return true;
        return true;
      });

      const mapped: HistoryItem[] = filteredRows
        .filter((row: any) => {
          const status = String(row?.verification_status || '').toLowerCase();
          return status !== 'pending';
        })
        .map((row: any) => mapAnyRowToHistory(row));

      setItems(sortByReviewedAt(mapped));
      setPage(1);
    } catch {
      setError('Failed to load history');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.worker_name.toLowerCase().includes(search.toLowerCase());
      const matchesAction = action === 'all' ? true : item.action_taken === action;

      const reviewed = new Date(item.reviewed_at);
      const fromOk = fromDate ? reviewed >= new Date(`${fromDate}T00:00:00`) : true;
      const toOk = toDate ? reviewed <= new Date(`${toDate}T23:59:59`) : true;

      return matchesSearch && matchesAction && fromOk && toOk;
    });
  }, [items, search, action, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const exportCsv = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `verifier-history-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <HistorySkeleton />;
  }

  if (error) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">
        <p className="text-sm font-medium">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500"
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search worker name"
            className="h-10 w-60 rounded-md border border-slate-300 px-3 text-sm"
          />

          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value as ActionFilter);
              setPage(1);
            }}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          >
            <option value="all">All Actions</option>
            <option value="verified">Verified</option>
            <option value="flagged">Flagged</option>
            <option value="unverifiable">Unverifiable</option>
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-md bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Worker Name</th>
                <th className="px-3 py-3">Platform</th>
                <th className="px-3 py-3">Date Submitted</th>
                <th className="px-3 py-3">Gross</th>
                <th className="px-3 py-3">Net</th>
                <th className="px-3 py-3">Action Taken</th>
                <th className="px-3 py-3">Reviewed At</th>
                <th className="px-3 py-3">Screenshot</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, index) => {
                const thumb = resolveImage(row.screenshot_url);
                return (
                  <tr key={row.id} className="group border-t border-slate-100 transition hover:bg-slate-50">
                    <td className="px-3 py-3 text-slate-500">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{row.worker_name}</td>
                    <td className="px-3 py-3 text-slate-700">{row.platform}</td>
                    <td className="px-3 py-3 text-slate-700">{formatDate(row.shift_date)}</td>
                    <td className="px-3 py-3 text-slate-700">PKR {formatMoney(row.gross_earned)}</td>
                    <td className="px-3 py-3 text-slate-700">PKR {formatMoney(row.net_received)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(row.action_taken)}`}>
                        {row.action_taken}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{formatDate(row.reviewed_at)}</td>
                    <td className="px-3 py-3">
                      {thumb ? (
                        <button type="button" onClick={() => setPreviewImage(thumb)} className="inline-flex rounded-md border border-slate-200 p-0.5">
                          <img src={thumb} alt="screenshot thumbnail" className="h-10 w-10 rounded object-cover" />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">No image</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Eye size={15} className="text-slate-300 group-hover:text-indigo-600" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!filtered.length ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">📭</div>
            <p className="text-sm text-slate-600">No history found for selected filters</p>
          </div>
        ) : null}
      </section>

      {filtered.length ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
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
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}

      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={() => setPreviewImage('')}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white"
          >
            <X size={18} />
          </button>
          <img src={previewImage} alt="screenshot preview" className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain" />
        </div>
      ) : null}
    </div>
  );
}
