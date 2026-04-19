'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE, authFetch } from '@/lib/api';

type PublicComplaint = {
  id: string;
  post_kind?: 'complaint' | 'intel' | 'support_request' | string;
  platform: string;
  category: string;
  description: string;
  tags: string[];
  status: string;
  upvotes: number;
  image_url?: string | null;
  created_at: string;
};

type MyComplaint = {
  id: string;
  post_kind?: 'complaint' | 'intel' | 'support_request' | string;
  platform: string;
  category: string;
  description: string;
  status: string;
  image_url?: string | null;
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
const postKinds = [
  { value: 'complaint', label: 'Complaint' },
  { value: 'intel', label: 'Intel' },
  { value: 'support_request', label: 'Support Request' },
];

function postKindLabel(kind: string | undefined) {
  if (!kind) return 'complaint';
  return kind.replaceAll('_', ' ');
}

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

function categoryLabel(category: string) {
  return category.replaceAll('_', ' ');
}

function advocateReply(status: string) {
  if (status === 'escalated') {
    return {
      message: 'This complaint is now under review by the advocate team. We are validating evidence and preparing next actions.',
      tone: 'text-amber-700',
    };
  }
  if (status === 'resolved') {
    return {
      message: 'This complaint has been reviewed and marked resolved. You can still post a new complaint if a related issue continues.',
      tone: 'text-emerald-700',
    };
  }
  return null;
}

function normalizeComplaintImageUrl(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE.grievance}${url}`;
  return `${API_BASE.grievance}/${url}`;
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [form, setForm] = useState({
    post_kind: 'complaint',
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
        post_kind: form.post_kind,
        platform: form.platform,
        category: form.post_kind === 'intel' ? 'other' : form.category,
        description: form.description,
        is_anonymous: form.is_anonymous,
        tags: [],
      };

      // Try token-secured route first, then legacy worker_id route as fallback.
      let res: Response | null = null;
      let data: unknown = {};

      try {
        if (imageFile) {
          const formData = new FormData();
          formData.append('platform', payload.platform);
          formData.append('post_kind', payload.post_kind);
          formData.append('category', payload.category);
          formData.append('description', payload.description);
          formData.append('is_anonymous', String(payload.is_anonymous));
          formData.append('image', imageFile);
          res = await authFetch(`${API_BASE.grievance}/api/complaints`, {
            method: 'POST',
            body: formData,
          });
        } else {
          res = await authFetch(`${API_BASE.grievance}/api/complaints`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
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

        const fallbackBody = imageFile
          ? (() => {
              const fd = new FormData();
              fd.append('worker_id', workerId);
              fd.append('platform', payload.platform);
              fd.append('post_kind', payload.post_kind);
              fd.append('category', payload.category);
              fd.append('description', payload.description);
              fd.append('is_anonymous', String(payload.is_anonymous));
              fd.append('image', imageFile);
              return fd;
            })()
          : JSON.stringify({ ...payload, worker_id: workerId });

        const fallbackRes = await fetch(`${API_BASE.grievance}/complaints`, {
          method: 'POST',
          headers: imageFile ? undefined : { 'Content-Type': 'application/json' },
          body: fallbackBody,
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

      setModalSuccess('Post submitted successfully');
      setForm((prev) => ({ ...prev, description: '', category: 'other', post_kind: 'complaint' }));
      setImageFile(null);
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
          <p className="text-sm text-slate-500">Latest public issues with platform, category, status, and tags</p>
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
            My Posts
          </button>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => {
              setModalError('');
              setModalSuccess('');
              setShowModal(true);
            }}
          >
            + New Post
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading complaints...</p>
        ) : complaints.length === 0 ? (
          <p className="text-sm text-slate-500">No complaints available yet.</p>
        ) : (
          <>
            <ul className="space-y-4">
            {complaints.map((complaint) => (
              <li key={complaint.id} className="rounded-xl border border-slate-200 px-4 py-4">
                <div className="grid grid-cols-[34px_1fr] gap-3">
                  <div className="relative">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                      FG
                    </div>
                    {advocateReply(complaint.status) ? (
                      <div className="absolute left-1/2 top-9 h-12 w-px -translate-x-1/2 bg-slate-200" />
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">Community Member</span>
                      <span>•</span>
                      <span>{formatRelativeTime(complaint.created_at)}</span>
                      <span>•</span>
                      <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>
                        platforms: <span className="font-bold text-slate-800">{complaint.platform}</span>
                      </span>
                      <span>•</span>
                      <span>
                        type: <span className="font-bold text-slate-800">#{categoryLabel(complaint.category).replaceAll(' ', '_')}</span>
                      </span>
                      <span>•</span>
                      <span>
                        post: <span className="font-bold text-slate-800">{postKindLabel(complaint.post_kind)}</span>
                      </span>
                      {complaint.status !== 'open' ? (
                        <>
                          <span>•</span>
                          <span>status: {complaint.status.replaceAll('_', ' ')}</span>
                        </>
                      ) : null}
                    </div>

                    <p className="mt-2 text-[15px] leading-7 text-slate-900">{complaint.description}</p>

                    {complaint.image_url ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl(normalizeComplaintImageUrl(complaint.image_url))}
                        className="mt-3 block overflow-hidden rounded-lg border border-slate-200"
                      >
                        <img
                          src={normalizeComplaintImageUrl(complaint.image_url)}
                          alt="Complaint evidence"
                          className="h-36 w-56 object-cover"
                        />
                      </button>
                    ) : null}

                    {!!complaint.tags?.length && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="font-semibold">tags:</span>
                        {complaint.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-semibold text-slate-700"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
                      <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-slate-100" type="button">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 0 0-3-3l-1 5-3 3v10h9.5a2 2 0 0 0 1.96-1.61L20 11a2 2 0 0 0-1.96-2H14Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 10H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" />
                        </svg>
                        <span>Like</span>
                      </button>
                      <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-slate-100" type="button">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 0 0 3 3l1-5 3-3V4H7.5a2 2 0 0 0-1.96 1.61L4 13a2 2 0 0 0 1.96 2H10Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 14h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3" />
                        </svg>
                        <span>Unlike</span>
                      </button>
                      <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-slate-100" type="button">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8 8 4-4 4 4" />
                        </svg>
                        <span>Share</span>
                      </button>
                    </div>

                    {advocateReply(complaint.status) ? (
                      <div className="mt-4 grid grid-cols-[26px_1fr] gap-3">
                        <div className="relative flex items-start justify-center">
                          <div className="h-6 w-6 rounded-full bg-slate-900 text-[10px] font-bold text-white flex items-center justify-center">A</div>
                          <div className="absolute -left-3 top-2 h-4 w-3 rounded-bl-xl border-b border-l border-slate-300" />
                        </div>
                        <p className={`text-xs leading-5 ${advocateReply(complaint.status)?.tone}`}>
                          {advocateReply(complaint.status)?.message}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
            </ul>
          </>
        )}
      </section>

      {showModal && mounted
        ? createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
              <h2 className="text-xl font-bold">Create New Post</h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded border border-slate-200/40 px-2 py-1 text-sm text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <form className="grid gap-3 p-6" onSubmit={submitComplaint}>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.post_kind}
                onChange={(e) => setForm((prev) => ({ ...prev, post_kind: e.target.value }))}
              >
                {postKinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>

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

                {form.post_kind === 'intel' ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Intel posts do not require a type</div>
                ) : (
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
                )}
              </div>

              <textarea
                className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Describe the post in detail (minimum 20 characters)"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Picture (optional)</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
                {imageFile ? <p className="mt-1 text-xs text-slate-500">Selected: {imageFile.name}</p> : null}
              </div>

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
                  {posting ? 'Posting...' : 'Submit Post'}
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
              <h2 className="text-xl font-bold">My Posts</h2>
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
                <p className="text-sm text-slate-500">Loading your posts...</p>
              ) : myComplaints.length === 0 ? (
                <p className="text-sm text-slate-500">You have not submitted any posts yet.</p>
              ) : (
                myComplaints.map((complaint) => (
                  <div key={complaint.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatRelativeTime(complaint.created_at)}</span>
                      <span>•</span>
                      <span>{complaint.platform}</span>
                      <span>•</span>
                      <span>{complaint.category.replaceAll('_', ' ')}</span>
                      <span>•</span>
                      <span>{postKindLabel(complaint.post_kind)}</span>
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

      {previewImageUrl && mounted
        ? createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
              <h2 className="text-lg font-bold">Complaint Image</h2>
              <button
                onClick={() => setPreviewImageUrl('')}
                className="rounded border border-slate-200/40 px-2 py-1 text-sm text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-slate-100 p-4">
              <img src={previewImageUrl} alt="Complaint evidence full" className="mx-auto max-h-[72vh] w-auto rounded-lg object-contain" />
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
