'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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

const categories = [
  'commission_hike',
  'account_deactivation',
  'payment_delay',
  'unfair_rating',
  'data_privacy',
  'other',
];

const platforms = ['Careem', 'Bykea', 'foodpanda', 'Upwork', 'Other'];

export default function CommunityPage() {
  const [complaints, setComplaints] = useState<PublicComplaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ platform: 'all', category: 'all' });
  const [form, setForm] = useState({
    platform: 'Careem',
    category: 'other',
    description: '',
    is_anonymous: true,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.platform !== 'all') params.set('platform', filters.platform);
    if (filters.category !== 'all') params.set('category', filters.category);
    return params.toString();
  }, [filters.category, filters.platform]);

  async function loadPublicComplaints() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_BASE.grievance}/api/complaints/public${queryString ? `?${queryString}` : ''}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not load complaint feed');
        return;
      }
      setComplaints(Array.isArray(data) ? data : []);
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPublicComplaints();
  }, [queryString]);

  async function submitComplaint(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.description.trim().length < 20) {
      setError('Description must be at least 20 characters long');
      return;
    }

    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints`, {
        method: 'POST',
        body: JSON.stringify({
          platform: form.platform,
          category: form.category,
          description: form.description,
          is_anonymous: form.is_anonymous,
          tags: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not submit complaint');
        return;
      }

      setSuccess('Complaint submitted successfully');
      setForm((prev) => ({ ...prev, description: '' }));
      await loadPublicComplaints();
    } catch {
      setError('Could not connect to grievance service');
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Grievance and Community Board</h1>

      <form className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submitComplaint}>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Post a Complaint</h2>
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
                {category}
              </option>
            ))}
          </select>
        </div>

        <textarea
          className="mt-3 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Describe the issue in detail (minimum 20 characters)"
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        />

        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.is_anonymous}
            onChange={(e) => setForm((prev) => ({ ...prev, is_anonymous: e.target.checked }))}
          />
          Post anonymously
        </label>

        <div className="mt-3">
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            type="submit"
          >
            Submit Complaint
          </button>
        </div>

        {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        {success && <p className="mt-2 text-sm font-medium text-emerald-700">{success}</p>}
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={filters.platform}
            onChange={(e) => setFilters((prev) => ({ ...prev, platform: e.target.value }))}
          >
            <option value="all">All Platforms</option>
            {platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading complaints...</p>
        ) : complaints.length === 0 ? (
          <p className="text-sm text-slate-500">No complaints available for these filters.</p>
        ) : (
          <ul className="space-y-3">
            {complaints.map((complaint) => (
              <li key={complaint.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{complaint.platform}</span>
                  <span>•</span>
                  <span>{complaint.category}</span>
                  <span>•</span>
                  <span className="capitalize">{complaint.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-800">{complaint.description}</p>
                {!!complaint.tags?.length && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {complaint.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
