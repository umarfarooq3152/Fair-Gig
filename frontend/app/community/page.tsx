'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE, authFetch } from '@/lib/api';

type PublicComplaint = {
  id: string;
  platform: string;
  category: string;
  description: string;
  tags: string[];
  status: string;
  upvotes: number;
  created_at: string;
};

type MyComplaint = {
  id: string;
  platform: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
  updated_at?: string;
};

const categories = [
  'commission_hike',
  'account_deactivation',
  'payment_delay',
  'unfair_rating',
  'data_privacy',
  'other',
];

const platforms = ['Careem', 'Bykea', 'foodpanda', 'Upwork', 'Other'];

function formatRelativeTime(dateLike: string) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return dateLike;
  const diffMs = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const absSeconds = Math.abs(Math.round(diffMs / 1000));
  if (absSeconds < 60) return rtf.format(Math.round(diffMs / 1000), 'second');
  const absMinutes = Math.abs(Math.round(diffMs / 60000));
  if (absMinutes < 60) return rtf.format(Math.round(diffMs / 60000), 'minute');
  const absHours = Math.abs(Math.round(diffMs / 3600000));
  if (absHours < 24) return rtf.format(Math.round(diffMs / 3600000), 'hour');
  return rtf.format(Math.round(diffMs / 86400000), 'day');
}

function statusClass(status: string) {
  if (status === 'resolved') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
  if (status === 'escalated') return 'bg-amber-100 text-amber-700 border-amber-300';
  return 'bg-blue-100 text-blue-700 border-blue-300';
}

export default function CommunityPage() {
  const [mounted, setMounted] = useState(false);
  const [complaints, setComplaints] = useState<PublicComplaint[]>([]);
  const [myComplaints, setMyComplaints] = useState<MyComplaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [myLoading, setMyLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [myModalError, setMyModalError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showMyModal, setShowMyModal] = useState(false);
  const [form, setForm] = useState({
    platform: 'Careem',
    category: 'other',
    description: '',
    is_anonymous: true,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadPublicComplaints() {
    setLoading(true);
    try {
      const endpointCandidates = [
        `${API_BASE.grievance}/api/complaints/public`,
        `${API_BASE.grievance}/complaints`,
      ];

      const merged = new Map<string, PublicComplaint>();
      for (const url of endpointCandidates) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          const data = await res.json().catch(() => []);
          if (!res.ok) {
            continue;
          }
          const rows = Array.isArray(data) ? (data as PublicComplaint[]) : [];
          rows.forEach((row) => {
            if (row?.id) {
              merged.set(String(row.id), row);
            }
          });
        } catch {
          // Continue and try next endpoint.
        }
      }

      const rows = Array.from(merged.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      if (rows.length === 0) {
        setComplaints([]);
      } else {
        setComplaints(rows);
      }
    } catch {
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyComplaints() {
    setMyLoading(true);
    setMyModalError('');

    try {
      const endpointCandidates = [
        async () => authFetch(`${API_BASE.grievance}/api/complaints/mine`, { cache: 'no-store' }),
        async () => {
          const workerId = localStorage.getItem('fairgig_user_id') || '';
          return fetch(`${API_BASE.grievance}/complaints?worker_id=${encodeURIComponent(workerId)}`, { cache: 'no-store' });
        },
      ];

      let loaded = false;
      for (const req of endpointCandidates) {
        try {
          const res = await req();
          const data = await res.json().catch(() => []);
          if (!res.ok) {
            continue;
          }
          const rows = Array.isArray(data) ? (data as MyComplaint[]) : [];
          setMyComplaints(rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
          loaded = true;
          break;
        } catch {
          // Try next fallback endpoint.
        }
      }

      if (!loaded) {
        setMyModalError('Could not load your complaints');
      }
    } finally {
      setMyLoading(false);
    }
  }

  useEffect(() => {
    void loadPublicComplaints();
  }, []);

  async function submitComplaint(e: FormEvent) {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    setPosting(true);

    if (form.description.trim().length < 20) {
      setModalError('Description must be at least 20 characters long');
      setPosting(false);
      return;
    }

    try {
      const payload = {
        platform: form.platform,
        category: form.category,
        description: form.description,
        is_anonymous: form.is_anonymous,
        tags: [],
      };

      // Try token-secured route first, then legacy worker_id route as fallback.
      let res: Response | null = null;
      let data: unknown = {};

      try {
        res = await authFetch(`${API_BASE.grievance}/api/complaints`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        data = await res.json().catch(() => ({}));
      } catch {
        res = null;
      }

      if (!res || !res.ok) {
        const workerId = localStorage.getItem('fairgig_user_id') || '';
        if (!workerId) {
          setModalError('Missing worker profile. Please login again.');
          return;
        }

        const fallbackRes = await fetch(`${API_BASE.grievance}/complaints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, worker_id: workerId }),
        });
        const fallbackData = await fallbackRes.json().catch(() => ({}));

        if (!fallbackRes.ok) {
          const primaryMessage = (data as { detail?: string })?.detail;
          const fallbackMessage = (fallbackData as { detail?: string })?.detail;
          setModalError(primaryMessage || fallbackMessage || 'Could not submit complaint');
          return;
        }

        res = fallbackRes;
        data = fallbackData;
      }

      if (!res.ok) {
        setModalError((data as { detail?: string })?.detail || 'Could not submit complaint');
        return;
      }

      setModalSuccess('Complaint submitted successfully');
      setForm((prev) => ({ ...prev, description: '' }));
      setShowModal(false);
      await loadPublicComplaints();
    } catch {
      setModalError('Could not connect to grievance service');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Community Complaints</h1>
          <p className="text-sm text-slate-500">Reddit-style public feed sorted by latest posts</p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setMyModalError('');
              setShowMyModal(true);
              void loadMyComplaints();
            }}
          >
            My Complaints
          </button>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => {
              setModalError('');
              setModalSuccess('');
              setShowModal(true);
            }}
          >
            + New Complaint
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading complaints...</p>
        ) : complaints.length === 0 ? (
          <p className="text-sm text-slate-500">No complaints available yet.</p>
        ) : (
          <ul className="space-y-3">
            {complaints.map((complaint) => (
              <li key={complaint.id} className="rounded-xl border border-slate-200 bg-white p-0 shadow-sm">
                <div className="grid grid-cols-[56px_1fr]">
                  <div className="flex flex-col items-center justify-center gap-1 border-r border-slate-200 bg-slate-50 py-4">
                    <span className="text-lg leading-none text-slate-500">▲</span>
                    <span className="text-sm font-bold text-slate-700">{complaint.upvotes || 0}</span>
                    <span className="text-lg leading-none text-slate-500">▼</span>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">r/fairgig</span>
                      <span>•</span>
                      <span>{formatRelativeTime(complaint.created_at)}</span>
                      <span>•</span>
                      <span>{complaint.platform}</span>
                      <span>•</span>
                      <span>{complaint.category.replaceAll('_', ' ')}</span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-800">{complaint.description}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${statusClass(complaint.status)}`}>
                        {complaint.status.replaceAll('_', ' ')}
                      </span>
                      {!!complaint.tags?.length && complaint.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showModal && mounted
        ? createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
              <h2 className="text-xl font-bold">Post New Complaint</h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded border border-slate-200/40 px-2 py-1 text-sm text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <form className="grid gap-3 p-6" onSubmit={submitComplaint}>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={form.platform}
                  onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
                >
                  {platforms.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Describe the issue in detail (minimum 20 characters)"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />

              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_anonymous}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_anonymous: e.target.checked }))}
                />
                Post anonymously
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
                  type="submit"
                  disabled={posting}
                >
                  {posting ? 'Posting...' : 'Submit Complaint'}
                </button>
              </div>

              {modalError ? <p className="text-sm font-medium text-red-600">{modalError}</p> : null}
              {modalSuccess ? <p className="text-sm font-medium text-emerald-700">{modalSuccess}</p> : null}
            </form>
          </div>
        </div>,
        document.body,
      ) : null}

      {showMyModal && mounted
        ? createPortal(
        <div className="fixed inset-0 z-[121] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
              <h2 className="text-xl font-bold">My Complaints</h2>
              <button
                onClick={() => setShowMyModal(false)}
                className="rounded border border-slate-200/40 px-2 py-1 text-sm text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-6">
              {myModalError ? <p className="text-sm font-medium text-red-600">{myModalError}</p> : null}
              {myLoading ? (
                <p className="text-sm text-slate-500">Loading your complaints...</p>
              ) : myComplaints.length === 0 ? (
                <p className="text-sm text-slate-500">You have not submitted any complaints yet.</p>
              ) : (
                myComplaints.map((complaint) => (
                  <div key={complaint.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatRelativeTime(complaint.created_at)}</span>
                      <span>•</span>
                      <span>{complaint.platform}</span>
                      <span>•</span>
                      <span>{complaint.category.replaceAll('_', ' ')}</span>
                    </div>
                    <p className="text-sm leading-6 text-slate-800">{complaint.description}</p>
                    <div className="mt-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${statusClass(complaint.status)}`}>
                        {complaint.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
