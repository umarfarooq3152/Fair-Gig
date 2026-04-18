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
  updated_at?: string;
};

type AdvocateFeedResponse = {
  items: AdvocateComplaint[];
  has_more: boolean;
  next_cursor: string | null;
};

type ClusterItem = {
  id: string;
  name: string;
  platform: string | null;
  primary_tag: string | null;
  complaint_count: number;
};

type SpikeItem = {
  platform: string;
  category: string;
  count: number;
  first_seen_at: string;
  latest_seen_at: string;
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

const platformOptions = ['Careem', 'Bykea', 'foodpanda', 'Upwork', 'Other'];

export default function AdvocateGrievancesPage() {
  const [items, setItems] = useState<AdvocateComplaint[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clusterName, setClusterName] = useState('Systemic Issue Cluster');
  const [clusterTag, setClusterTag] = useState('payment_delay');
  const [existingClusterId, setExistingClusterId] = useState('');
  const [bulkTagsInput, setBulkTagsInput] = useState('');
  const [message, setMessage] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [spikes, setSpikes] = useState<SpikeItem[]>([]);

  const [actionBusy, setActionBusy] = useState(false);

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

  const newestTimestamp = useMemo(() => items[0]?.created_at || '', [items]);
  const selectedCount = selectedIds.length;

  function buildFilterParams() {
    const params = new URLSearchParams();
    if (filters.platform !== 'all') params.set('platform', filters.platform);
    if (filters.category !== 'all') params.set('category', filters.category);
    if (filters.status !== 'all') params.set('status', filters.status);
    return params;
  }

  async function loadFeed(reset: boolean) {
    if (reset) {
      setLoadingInitial(true);
    } else {
      setLoadingMore(true);
    }
    setError('');

    const params = buildFilterParams();
    params.set('limit', '50');
    if (!reset && nextCursor) {
      params.set('cursor', nextCursor);
    }

    try {
      const res = await authFetch(
        `${API_BASE.grievance}/api/complaints/advocate/feed?${params.toString()}`,
      );
      const data = (await res.json()) as AdvocateFeedResponse;
      if (!res.ok) {
        setError((data as any)?.detail || 'Could not load complaints');
        return;
      }

      setItems((prev) => {
        const incoming = Array.isArray(data.items) ? data.items : [];
        if (reset) {
          return incoming;
        }
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...incoming.filter((item) => !seen.has(item.id))];
      });
      setHasMore(Boolean(data.has_more));
      setNextCursor(data.next_cursor || null);
      if (reset) {
        setSelectedIds([]);
      }
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      if (reset) {
        setLoadingInitial(false);
      } else {
        setLoadingMore(false);
      }
    }
  }

  async function loadClusters() {
    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/clusters?limit=100`);
      const data = await res.json();
      if (res.ok) {
        setClusters(Array.isArray(data) ? data : []);
      }
    } catch {
      // Keep queue usable even if cluster list fails.
    }
  }

  async function loadSpikeAlerts() {
    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/alerts/spikes?window_hours=3&min_count=5`);
      const data = await res.json();
      if (res.ok) {
        setSpikes(Array.isArray(data?.items) ? data.items : []);
      }
    } catch {
      // Sidebar widget can fail independently.
    }
  }

  async function refreshNewCount() {
    if (!newestTimestamp) return;
    const params = buildFilterParams();
    params.set('since', newestTimestamp);

    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/advocate/new-count?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setNewCount(Number(data?.count || 0));
      }
    } catch {
      // Ignore transient polling errors.
    }
  }

  useEffect(() => {
    void loadFeed(true);
    void loadClusters();
    void loadSpikeAlerts();
  }, [filters.category, filters.platform, filters.status]);

  useEffect(() => {
    if (!newestTimestamp) return;
    const timer = setInterval(() => {
      void refreshNewCount();
      void loadSpikeAlerts();
    }, 30000);
    return () => clearInterval(timer);
  }, [newestTimestamp, filters.category, filters.platform, filters.status]);

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

    setActionBusy(true);
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
      const data = await res.json();
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
      setSelectedIds([]);
      await loadClusters();
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      setActionBusy(false);
    }
  }

  async function addToExistingCluster() {
    if (!existingClusterId) {
      setError('Choose an existing cluster first');
      return;
    }
    if (selectedIds.length < 1) {
      setError('Select at least one complaint to add to a cluster');
      return;
    }

    setError('');
    setMessage('');
    setActionBusy(true);

    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/cluster/${existingClusterId}/add`, {
        method: 'POST',
        body: JSON.stringify({ complaint_ids: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not add complaints to cluster');
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          data.linked_complaint_ids?.includes(item.id)
            ? { ...item, cluster_id: existingClusterId }
            : item,
        ),
      );
      setMessage(`Added ${data.linked_count} complaints to selected cluster.`);
      setSelectedIds([]);
      await loadClusters();
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      setActionBusy(false);
    }
  }

  async function assignTagsToSelected() {
    const tags = bulkTagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (selectedIds.length < 1) {
      setError('Select at least one complaint first');
      return;
    }
    if (!tags.length) {
      setError('Enter one or more tags separated by commas');
      return;
    }

    setError('');
    setMessage('');
    setActionBusy(true);

    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/bulk/tags`, {
        method: 'POST',
        body: JSON.stringify({ complaint_ids: selectedIds, tags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not assign tags');
        return;
      }

      setItems((prev) => prev.map((item) => (selectedIds.includes(item.id) ? { ...item, tags } : item)));
      setMessage(`Assigned tags to ${data.updated_count} complaints.`);
      setSelectedIds([]);
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      setActionBusy(false);
    }
  }

  async function updateSelectedStatus(status: 'escalated' | 'resolved') {
    if (selectedIds.length < 1) {
      setError('Select at least one complaint first');
      return;
    }

    setError('');
    setMessage('');
    setActionBusy(true);

    try {
      if (selectedClusterId) {
        const res = await authFetch(`${API_BASE.grievance}/api/complaints/cluster/${selectedClusterId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.detail || 'Could not update cluster status');
          return;
        }
        setItems((prev) =>
          prev.map((item) =>
            item.cluster_id === selectedClusterId ? { ...item, status } : item,
          ),
        );
        setMessage(`Cluster cascade applied: ${status} on ${data.affected_count} complaints.`);
      } else {
        const res = await authFetch(`${API_BASE.grievance}/api/complaints/bulk/status`, {
          method: 'POST',
          body: JSON.stringify({ complaint_ids: selectedIds, status }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.detail || 'Could not update selected complaints');
          return;
        }
        setItems((prev) =>
          prev.map((item) => (selectedIds.includes(item.id) ? { ...item, status } : item)),
        );
        setMessage(`Updated ${data.updated_count} complaints to ${status}.`);
      }

      setSelectedIds([]);
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      setActionBusy(false);
    }
  }

  async function unclusterComplaint(id: string) {
    setError('');
    setMessage('');
    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/${id}/uncluster`, {
        method: 'PUT',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not remove complaint from cluster');
        return;
      }

      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)));
      setMessage('Complaint removed from cluster and reverted to open.');
      await loadClusters();
    } catch {
      setError('Could not connect to grievance service');
    }
  }

  async function loadNewComplaints() {
    await loadFeed(true);
    setNewCount(0);
  }

  function statusBadgeClass(status: AdvocateComplaint['status']) {
    if (status === 'resolved') return 'bg-emerald-100 text-emerald-800';
    if (status === 'escalated') return 'bg-amber-100 text-amber-800';
    if (status === 'rejected') return 'bg-rose-100 text-rose-800';
    return 'bg-slate-100 text-slate-700';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Advocate Grievance Dashboard</h1>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => {
            void loadFeed(true);
            void loadSpikeAlerts();
          }}
        >
          Refresh Queue
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr,300px]">
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          {newCount > 0 && (
            <button
              type="button"
              className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              onClick={() => void loadNewComplaints()}
            >
              Load {newCount} New Complaint{newCount > 1 ? 's' : ''}
            </button>
          )}

          <div className="grid gap-2 md:grid-cols-3">
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={filters.platform}
              onChange={(e) => setFilters((prev) => ({ ...prev, platform: e.target.value }))}
            >
              <option value="all">All Platforms</option>
              {platformOptions.map((platform) => (
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

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          {message && <p className="text-sm font-medium text-emerald-700">{message}</p>}

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-[36px,180px,130px,1fr,160px,120px,170px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <label className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selectedIds.length === items.length}
                  onChange={(e) => toggleAllVisible(e.target.checked)}
                />
              </label>
              <span>Timestamp</span>
              <span>Platform</span>
              <span>Preview</span>
              <span>Tags</span>
              <span>Status</span>
              <span>Cluster</span>
            </div>

            <div className="max-h-[68vh] overflow-auto">
              {loadingInitial ? (
                <div className="px-3 py-4 text-sm text-slate-600">Loading complaints...</div>
              ) : items.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-600">No complaints found for current filters.</div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[36px,180px,130px,1fr,160px,120px,170px] gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-700">
                    <label className="flex items-start justify-center pt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleRow(item.id)}
                      />
                    </label>
                    <div>
                      <p>{new Date(item.created_at).toLocaleString()}</p>
                      <p className="text-[11px] text-slate-500">{item.worker_name}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{item.platform}</p>
                      <p className="text-[11px] text-slate-500">{item.category}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{item.description.slice(0, 88)}</p>
                      <textarea
                        className="mt-1 h-14 w-full rounded border border-slate-300 px-2 py-1 text-[11px]"
                        defaultValue={item.description}
                        onBlur={(e) =>
                          void moderateComplaint(item.id, {
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <p className="truncate text-[11px] text-slate-500">{(item.tags || []).join(', ') || 'No tags'}</p>
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-[11px]"
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
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold capitalize ${statusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div>
                      {item.cluster_id ? (
                        <div className="space-y-1">
                          <p className="truncate text-[11px] text-slate-500">{item.cluster_id}</p>
                          <button
                            type="button"
                            className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700"
                            onClick={() => void unclusterComplaint(item.id)}
                          >
                            Un-cluster
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Unclustered</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {hasMore && (
            <button
              type="button"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={loadingMore}
              onClick={() => void loadFeed(false)}
            >
              {loadingMore ? 'Loading more...' : 'Load More'}
            </button>
          )}
        </section>

        <aside className="space-y-3">
          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Spike Alert (Last 3 Hours)</h2>
            <p className="mt-1 text-xs text-slate-500">High-volume complaint groups that should be clustered quickly.</p>

            <div className="mt-3 space-y-2">
              {spikes.length === 0 ? (
                <p className="text-xs text-slate-500">No significant spikes right now.</p>
              ) : (
                spikes.map((spike) => (
                  <div key={`${spike.platform}-${spike.category}`} className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                    <p className="text-xs font-semibold text-amber-900">{spike.platform} · {spike.category}</p>
                    <p className="text-[11px] text-amber-800">{spike.count} complaints in 3h</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Cluster Quick Select</h2>
            <p className="mt-1 text-xs text-slate-500">Use with “Add to Existing Cluster” in action bar.</p>
            <select
              className="mt-3 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
              value={existingClusterId}
              onChange={(e) => setExistingClusterId(e.target.value)}
            >
              <option value="">Select cluster</option>
              {clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name} ({cluster.complaint_count})
                </option>
              ))}
            </select>
          </section>
        </aside>
      </div>

      {selectedCount > 0 && (
        <div className="sticky bottom-3 z-20 rounded-xl border border-slate-900 bg-slate-950 p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{selectedCount} selected</p>
            <button
              type="button"
              className="rounded border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-6">
            <input
              className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100 placeholder:text-slate-500"
              placeholder="Assign tags: missing_pay, friday_crash"
              value={bulkTagsInput}
              onChange={(e) => setBulkTagsInput(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-900 disabled:opacity-60"
              onClick={() => void assignTagsToSelected()}
              disabled={actionBusy}
            >
              Assign Tags
            </button>

            <input
              className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100 placeholder:text-slate-500"
              placeholder="New cluster name"
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
            />
            <input
              className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100 placeholder:text-slate-500"
              placeholder="Primary tag"
              value={clusterTag}
              onChange={(e) => setClusterTag(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-sky-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60"
              onClick={() => void createClusterFromSelected()}
              disabled={actionBusy}
            >
              Create New Cluster
            </button>
            <button
              type="button"
              className="rounded bg-slate-700 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60"
              onClick={() => void addToExistingCluster()}
              disabled={actionBusy}
            >
              Add to Existing Cluster
            </button>

            <button
              type="button"
              className="rounded bg-amber-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60"
              onClick={() => void updateSelectedStatus('escalated')}
              disabled={actionBusy}
            >
              Mark Escalated
            </button>
            <button
              type="button"
              className="rounded bg-emerald-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60"
              onClick={() => void updateSelectedStatus('resolved')}
              disabled={actionBusy}
            >
              Mark Resolved
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
