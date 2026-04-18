import { FormEvent, useEffect, useState } from 'react';
import { grievanceBases, platforms } from '../app/config';
import { fetchWithFallback, getErrorMessage } from '../app/helpers';
import type { ComplaintItem, UserRole } from '../app/types';

type Props = {
  role: UserRole;
  token: string;
};

export default function CommunityBoard({ role, token }: Props) {
  const [items, setItems] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [form, setForm] = useState({ platform: 'Careem', category: 'other', description: '', is_anonymous: true });

  async function loadBoard() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterPlatform !== 'all') params.set('platform', filterPlatform);
      if (filterCategory !== 'all') params.set('category', filterCategory);
      const { response, payload } = await fetchWithFallback(grievanceBases, `/complaints/public${params.toString() ? `?${params.toString()}` : ''}`);
      if (!response.ok) {
        setError(getErrorMessage(payload, 'Could not load community board'));
        return;
      }
      setItems(Array.isArray(payload) ? payload : []);
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBoard();
  }, [filterPlatform, filterCategory]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.description.trim().length < 20) {
      setError('Description must be at least 20 characters');
      return;
    }

    const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      setError(getErrorMessage(payload, 'Could not submit complaint'));
      return;
    }

    setSuccess('Complaint submitted');
    setForm((prev) => ({ ...prev, description: '' }));
    await loadBoard();
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Community Board</h2>
        <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold" onClick={() => void loadBoard()}>
          Refresh
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}>
          <option value="all">All Platforms</option>
          {platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
        </select>
        <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="commission_hike">commission_hike</option>
          <option value="account_deactivation">account_deactivation</option>
          <option value="payment_delay">payment_delay</option>
          <option value="unfair_rating">unfair_rating</option>
          <option value="data_privacy">data_privacy</option>
          <option value="other">other</option>
        </select>
      </div>

      {role === 'worker' && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.platform} onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}>
              {platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
            </select>
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}>
              <option value="commission_hike">commission_hike</option>
              <option value="account_deactivation">account_deactivation</option>
              <option value="payment_delay">payment_delay</option>
              <option value="unfair_rating">unfair_rating</option>
              <option value="data_privacy">data_privacy</option>
              <option value="other">other</option>
            </select>
          </div>
          <textarea className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Describe complaint (minimum 20 chars)" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.is_anonymous} onChange={(e) => setForm((prev) => ({ ...prev, is_anonymous: e.target.checked }))} />Post anonymously</label>
          <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" type="submit">Post Complaint</button>
        </form>
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {success && <p className="text-sm font-medium text-emerald-700">{success}</p>}

      {loading ? (
        <p className="text-sm text-slate-600">Loading community feed...</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="w-14 shrink-0 rounded-lg bg-slate-100 px-2 py-3 text-center">
                <p className="text-lg font-black text-slate-900">{item.upvotes ?? 0}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">votes</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{item.platform} · {item.category}</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">{item.description.slice(0, 90)}</h3>
                <p className="mt-1 text-sm text-slate-700">{item.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold capitalize text-slate-700">{item.status}</span>
                  <span>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Unknown date'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
