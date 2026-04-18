'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_BASE, authFetch } from '@/lib/api';

type AdvocateComplaint = {
  id: string;
  worker_id: string;
  worker_name: string;
  worker_email: string;
  platform: string;
  category: string;
  description: string;
  is_anonymous: boolean;
  tags: string[];
  status: 'open' | 'escalated' | 'resolved' | 'rejected';
  cluster_id: string | null;
  created_at: string;
};

type ClusterResponse = {
  cluster: {
    id: string;
    name: string;
    platform: string | null;
    primary_tag: string | null;
  };
  linked_count: number;
  linked_complaint_ids: string[];
};

const statuses = ['open', 'escalated', 'resolved', 'rejected'] as const;
const categories = [
  'commission_hike',
  'account_deactivation',
  'payment_delay',
  'unfair_rating',
  'data_privacy',
  'other',
];

export default function AdvocateGrievancesPage() {
  const [items, setItems] = useState<AdvocateComplaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clusterName, setClusterName] = useState('');
  const [clusterTag, setClusterTag] = useState('');
  const [clusterStatus, setClusterStatus] = useState<'open' | 'escalated' | 'resolved' | 'rejected'>('escalated');
  const [message, setMessage] = useState('');

  const [filters, setFilters] = useState({ platform: 'all', category: 'all', status: 'all' });

  const selectedComplaints = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );

  const selectedClusterId = useMemo(() => {
    const clusterIds = Array.from(
      new Set(selectedComplaints.map((item) => item.cluster_id).filter(Boolean)),
    ) as string[];
    return clusterIds.length === 1 ? clusterIds[0] : '';
  }, [selectedComplaints]);

  async function load() {
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (filters.platform !== 'all') params.set('platform', filters.platform);
    if (filters.category !== 'all') params.set('category', filters.category);
    if (filters.status !== 'all') params.set('status', filters.status);

    try {
      const res = await authFetch(
        `${API_BASE.grievance}/api/complaints/advocate${params.toString() ? `?${params.toString()}` : ''}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not load complaints');
        return;
      }
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [filters.category, filters.platform, filters.status]);

  function toggleRow(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  function toggleAllVisible(checked: boolean) {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(items.map((item) => item.id));
  }

  async function moderateComplaint(id: string, patch: Partial<AdvocateComplaint>) {
    setMessage('');
    setError('');

    const payload: Record<string, unknown> = {};
    if (patch.tags) payload.tags = patch.tags;
    if (patch.category) payload.category = patch.category;
    if (patch.description) payload.description = patch.description;

    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/${id}/moderate`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not moderate complaint');
        return;
      }

      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)));
      setMessage('Complaint updated');
    } catch {
      setError('Could not connect to grievance service');
    }
  }

  async function createClusterFromSelected() {
    if (selectedIds.length < 2) {
      setError('Select at least two complaints to create a cluster');
      return;
    }

    setError('');
    setMessage('');

    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/cluster`, {
        method: 'POST',
        body: JSON.stringify({
          complaint_ids: selectedIds,
          name: clusterName || `Cluster ${new Date().toLocaleString()}`,
          primary_tag: clusterTag || 'untagged',
          platform: selectedComplaints[0]?.platform || null,
        }),
      });
      const data = (await res.json()) as ClusterResponse;
      if (!res.ok) {
        setError((data as any)?.detail || 'Could not create cluster');
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          data.linked_complaint_ids.includes(item.id)
            ? { ...item, cluster_id: data.cluster.id }
            : item,
        ),
      );
      setMessage(`Cluster created. Linked ${data.linked_count} complaints.`);
    } catch {
      setError('Could not connect to grievance service');
    }
  }

  async function cascadeSelectedClusterStatus() {
    if (!selectedClusterId) {
      setError('Select complaints from exactly one existing cluster to cascade status');
      return;
    }

    setError('');
    setMessage('');

    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/cluster/${selectedClusterId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: clusterStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not cascade cluster status');
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.cluster_id === selectedClusterId ? { ...item, status: clusterStatus } : item,
        ),
      );
      setMessage(`Cascaded ${clusterStatus} to ${data.affected_count} complaints.`);
    } catch {
      setError('Could not connect to grievance service');
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Advocate Grievance Dashboard</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={filters.platform}
            onChange={(e) => setFilters((prev) => ({ ...prev, platform: e.target.value }))}
          >
            <option value="all">All Platforms</option>
            <option value="Careem">Careem</option>
            <option value="Bykea">Bykea</option>
            <option value="foodpanda">foodpanda</option>
            <option value="Upwork">Upwork</option>
            <option value="Other">Other</option>
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

          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Cluster name"
            value={clusterName}
            onChange={(e) => setClusterName(e.target.value)}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Primary tag"
            value={clusterTag}
            onChange={(e) => setClusterTag(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={clusterStatus}
            onChange={(e) => setClusterStatus(e.target.value as typeof clusterStatus)}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              type="button"
              onClick={() => void createClusterFromSelected()}
            >
              Cluster Selected
            </button>
            <button
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              type="button"
              onClick={() => void cascadeSelectedClusterStatus()}
            >
              Toggle Esc/Res
            </button>
          </div>
        </div>

        {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}
        {message && <p className="mb-2 text-sm font-medium text-emerald-700">{message}</p>}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-2 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.length === items.length}
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                  />
                </th>
                <th className="px-2 py-2 text-left">Worker</th>
                <th className="px-2 py-2 text-left">Platform</th>
                <th className="px-2 py-2 text-left">Category</th>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-left">Tags</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Cluster</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-2 py-3 text-slate-500" colSpan={8}>
                    Loading complaints...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-slate-500" colSpan={8}>
                    No complaints found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleRow(item.id)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-900">{item.worker_name}</div>
                      <div className="text-xs text-slate-500">{item.worker_email}</div>
                      <div className="text-[11px] text-slate-500">ID: {item.worker_id}</div>
                    </td>
                    <td className="px-2 py-2">{item.platform}</td>
                    <td className="px-2 py-2">
                      <select
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        value={item.category}
                        onChange={(e) => void moderateComplaint(item.id, { category: e.target.value as any })}
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <textarea
                        className="min-h-20 w-64 rounded border border-slate-300 px-2 py-1 text-xs"
                        defaultValue={item.description}
                        onBlur={(e) =>
                          void moderateComplaint(item.id, {
                            description: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className="w-44 rounded border border-slate-300 px-2 py-1 text-xs"
                        defaultValue={(item.tags || []).join(',')}
                        onBlur={(e) =>
                          void moderateComplaint(item.id, {
                            tags: e.target.value
                              .split(',')
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-500">{item.cluster_id || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
