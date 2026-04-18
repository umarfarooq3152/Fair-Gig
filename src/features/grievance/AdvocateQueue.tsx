import { useEffect, useMemo, useState } from 'react';
import { clusterTagOptions, grievanceBases } from '../app/config';
import { fetchWithFallback, getErrorMessage } from '../app/helpers';
import type { ComplaintCluster, ComplaintItem, ComplaintSpike } from '../app/types';

type Props = {
  token: string;
};

function statusChipClass(status: ComplaintItem['status']) {
  if (status === 'resolved') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'escalated') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (status === 'rejected') return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function initials(name: string) {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 'FG';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
}

export default function AdvocateQueue({ token }: Props) {
  const [items, setItems] = useState<ComplaintItem[]>([]);
  const [clusters, setClusters] = useState<ComplaintCluster[]>([]);
  const [spikes, setSpikes] = useState<ComplaintSpike[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [platformFilter, setPlatformFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ComplaintItem['status']>('all');
  const [search, setSearch] = useState('');
  const [focusClusterId, setFocusClusterId] = useState<'all' | '__unclustered__' | string>('all');

  const [clusterName, setClusterName] = useState('Systemic Issue Cluster');
  const [clusterTag, setClusterTag] = useState('payment_delay');
  const [existingClusterId, setExistingClusterId] = useState('all');
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');

  const [showClusterModal, setShowClusterModal] = useState(false);
  const [clusterFilter, setClusterFilter] = useState('');
  const [clusterModalMode, setClusterModalMode] = useState<'full' | 'create-only'>('full');
  const [draggedComplaintId, setDraggedComplaintId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<null | {
    title: string;
    message: string;
    actionLabel: string;
    action: () => Promise<void>;
  }>(null);

  const selectedItems = useMemo(() => items.filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);
  const selectedClusterId = useMemo(() => {
    const uniqueClusterIds = Array.from(new Set(selectedItems.map((item) => item.cluster_id).filter(Boolean))) as string[];
    return uniqueClusterIds.length === 1 ? uniqueClusterIds[0] : '';
  }, [selectedItems]);

  async function loadQueue() {
    setLoading(true);
    setError('');
    const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/advocate', {
      headers: { Authorization: `Bearer ${token}` },
    });
    setLoading(false);

    if (!response.ok) {
      setError(getErrorMessage(payload, 'Could not load complaints'));
      return;
    }

    setItems(Array.isArray(payload) ? payload : []);
  }

  async function loadClusters() {
    const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/clusters?limit=100', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      setClusters(Array.isArray(payload) ? payload : []);
    }
  }

  async function loadSpikes() {
    const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/alerts/spikes?window_hours=3&min_count=5', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      setSpikes(Array.isArray(payload?.items) ? payload.items : []);
    }
  }

  useEffect(() => {
    void loadQueue();
    void loadClusters();
    void loadSpikes();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [focusClusterId, platformFilter, categoryFilter, statusFilter, search]);

  async function withBusy(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  function getActionComplaintIds() {
    if (draggedComplaintId && selectedIds.length === 0) {
      return [draggedComplaintId];
    }
    if (draggedComplaintId && !selectedIds.includes(draggedComplaintId)) {
      return [...selectedIds, draggedComplaintId];
    }
    return selectedIds;
  }

  function beginDragComplaint(id: string) {
    setDraggedComplaintId(id);
  }

  function endDragComplaint() {
    setDraggedComplaintId(null);
  }

  function openCreateClusterFromDragDrop() {
    const ids = getActionComplaintIds();
    if (ids.length < 1) {
      setError('Select or drag at least one complaint first');
      return;
    }
    setSelectedIds(ids);
    setShowClusterModal(true);
  }

  const filteredClusters = useMemo(() => {
    const needle = clusterFilter.trim().toLowerCase();
    if (!needle) return clusters;

    return clusters.filter((cluster) => {
      const name = String(cluster.name || '').toLowerCase();
      const platform = String(cluster.platform || '').toLowerCase();
      const tag = String(cluster.primary_tag || '').toLowerCase();
      return name.includes(needle) || platform.includes(needle) || tag.includes(needle);
    });
  }, [clusterFilter, clusters]);

  const platformOptions = useMemo(() => Array.from(new Set(items.map((item) => item.platform))).sort((a, b) => a.localeCompare(b)), [items]);
  const categoryOptions = useMemo(() => Array.from(new Set(items.map((item) => item.category))).sort((a, b) => a.localeCompare(b)), [items]);
  const tagOptions = useMemo(() => Array.from(new Set(items.flatMap((item) => item.tags || []))).sort((a, b) => a.localeCompare(b)), [items]);
  const clusterNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cluster of clusters) map[cluster.id] = cluster.name;
    return map;
  }, [clusters]);

  const visibleItems = useMemo(() => {
    let scoped = items;

    if (focusClusterId === '__unclustered__') {
      scoped = scoped.filter((item) => !item.cluster_id);
    } else if (focusClusterId !== 'all') {
      scoped = scoped.filter((item) => item.cluster_id === focusClusterId);
    }

    if (platformFilter !== 'all') scoped = scoped.filter((item) => item.platform === platformFilter);
    if (categoryFilter !== 'all') scoped = scoped.filter((item) => item.category === categoryFilter);
    if (tagFilter !== 'all') scoped = scoped.filter((item) => (item.tags || []).includes(tagFilter));
    if (statusFilter !== 'all') scoped = scoped.filter((item) => item.status === statusFilter);

    const needle = search.trim().toLowerCase();
    if (needle) {
      scoped = scoped.filter((item) => {
        const desc = String(item.description || '').toLowerCase();
        const worker = String(item.worker_name || item.worker_id || '').toLowerCase();
        const tags = (item.tags || []).join(',').toLowerCase();
        return desc.includes(needle) || worker.includes(needle) || tags.includes(needle);
      });
    }

    return scoped.sort((a, b) => {
      const left = new Date(a.created_at || 0).getTime();
      const right = new Date(b.created_at || 0).getTime();
      return right - left;
    });
  }, [items, focusClusterId, platformFilter, categoryFilter, tagFilter, statusFilter, search]);

  const grouped = useMemo(() => {
    const out: Record<string, Record<string, ComplaintItem[]>> = {};
    for (const item of visibleItems) {
      if (!out[item.platform]) out[item.platform] = {};
      if (!out[item.platform][item.category]) out[item.platform][item.category] = [];
      out[item.platform][item.category].push(item);
    }
    return out;
  }, [visibleItems]);

  const visibleSelectedCount = useMemo(
    () => visibleItems.filter((item) => selectedIds.includes(item.id)).length,
    [visibleItems, selectedIds],
  );

  function selectAllVisible() {
    setSelectedIds(visibleItems.map((item) => item.id));
  }

  async function assignTags() {
    if (selectedIds.length < 1 || bulkTags.length < 1) {
      setError('Select complaints and provide at least one tag');
      return;
    }

    await withBusy(async () => {
      const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/bulk/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ complaint_ids: selectedIds, tags: bulkTags }),
      });
      if (!response.ok) {
        setError(getErrorMessage(payload, 'Could not assign tags'));
        return;
      }

      setItems((prev) => prev.map((item) => (selectedIds.includes(item.id) ? { ...item, tags: bulkTags } : item)));
      setSelectedIds([]);
      setBulkTags([]);
      setSuccess('Tags assigned');
    });
  }

  function addTagChip(raw: string) {
    const next = raw.trim().replace(/^#/, '').toLowerCase();
    if (!next) return;
    setBulkTags((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setTagDraft('');
  }

  function removeTagChip(tag: string) {
    setBulkTags((prev) => prev.filter((t) => t !== tag));
  }

  async function createCluster() {
    const complaintIds = getActionComplaintIds();
    if (complaintIds.length < 1) {
      setError('Select at least one complaint');
      return;
    }

    await withBusy(async () => {
      const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          complaint_ids: complaintIds,
          name: clusterName,
          primary_tag: clusterTag,
          platform: items.find((item) => complaintIds.includes(item.id))?.platform || null,
        }),
      });

      if (!response.ok) {
        setError(getErrorMessage(payload, 'Could not create cluster'));
        return;
      }

      const linkedIds: string[] = payload?.linked_complaint_ids || [];
      const clusterId = payload?.cluster?.id;
      setItems((prev) => prev.map((item) => (linkedIds.includes(item.id) ? { ...item, cluster_id: clusterId } : item)));
      setSelectedIds([]);
      setShowClusterModal(false);
      endDragComplaint();
      await loadClusters();
      setSuccess('Cluster created');
    });
  }

  async function addToExistingCluster(targetClusterId?: string) {
    const clusterId = targetClusterId || existingClusterId;
    const complaintIds = getActionComplaintIds();
    if (!clusterId || clusterId === 'all' || complaintIds.length < 1) {
      setError('Select cluster and complaints first');
      return;
    }

    await withBusy(async () => {
      const { response, payload } = await fetchWithFallback(grievanceBases, `/complaints/cluster/${clusterId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ complaint_ids: complaintIds }),
      });

      if (!response.ok) {
        setError(getErrorMessage(payload, 'Could not add to cluster'));
        return;
      }

      const linkedIds: string[] = payload?.linked_complaint_ids || [];
      setItems((prev) => prev.map((item) => (linkedIds.includes(item.id) ? { ...item, cluster_id: clusterId } : item)));
      setSelectedIds([]);
      setShowClusterModal(false);
      endDragComplaint();
      await loadClusters();
      setSuccess('Added to cluster');
    });
  }

  async function updateStatus(nextStatus: 'escalated' | 'resolved') {
    if (selectedIds.length < 1) {
      setError('Select at least one complaint');
      return;
    }

    await withBusy(async () => {
      if (selectedClusterId) {
        const { response, payload } = await fetchWithFallback(grievanceBases, `/complaints/cluster/${selectedClusterId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: nextStatus }),
        });

        if (!response.ok) {
          setError(getErrorMessage(payload, 'Could not cascade status'));
          return;
        }

        setItems((prev) => prev.map((item) => (item.cluster_id === selectedClusterId ? { ...item, status: nextStatus } : item)));
      } else {
        const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/bulk/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ complaint_ids: selectedIds, status: nextStatus }),
        });

        if (!response.ok) {
          setError(getErrorMessage(payload, 'Could not update status'));
          return;
        }

        setItems((prev) => prev.map((item) => (selectedIds.includes(item.id) ? { ...item, status: nextStatus } : item)));
      }

      setSelectedIds([]);
      setSuccess(`Marked ${nextStatus}`);
    });
  }

  async function uncluster(id: string) {
    await withBusy(async () => {
      const { response, payload } = await fetchWithFallback(grievanceBases, `/complaints/${id}/uncluster`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setError(getErrorMessage(payload, 'Could not un-cluster complaint'));
        return;
      }

      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...payload } : item)));
      await loadClusters();
      setSuccess('Complaint moved back to open');
    });
  }

  async function updateClusterStatus(clusterId: string, nextStatus: 'escalated' | 'resolved') {
    await withBusy(async () => {
      const { response, payload } = await fetchWithFallback(grievanceBases, `/complaints/cluster/${clusterId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        setError(getErrorMessage(payload, 'Could not update cluster status'));
        return;
      }

      setItems((prev) => prev.map((item) => (item.cluster_id === clusterId ? { ...item, status: nextStatus } : item)));
      setSuccess(`Cluster marked ${nextStatus}`);
    });
  }

  async function deleteCluster(clusterId: string) {
    await withBusy(async () => {
      const { response, payload } = await fetchWithFallback(grievanceBases, `/complaints/cluster/${clusterId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setError(getErrorMessage(payload, 'Could not delete cluster'));
        return;
      }

      setItems((prev) => prev.map((item) => (item.cluster_id === clusterId ? { ...item, cluster_id: null } : item)));
      setClusters((prev) => prev.filter((cluster) => cluster.id !== clusterId));
      if (existingClusterId === clusterId) setExistingClusterId('all');
      if (focusClusterId === clusterId) setFocusClusterId('all');
      setSuccess('Cluster deleted');
    });
  }

  function requestConfirm(title: string, message: string, actionLabel: string, action: () => Promise<void>) {
    setConfirmModal({ title, message, actionLabel, action });
  }

  const platformEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  return (
    <section className="space-y-4">
      <div className="grid auto-rows-[minmax(120px,auto)] gap-4 xl:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Queue Filters</h3>
          <div className="mt-3 grid gap-2">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Search description / worker / tags"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="grid gap-2 md:grid-cols-2">
              <select className="rounded border border-slate-300 px-2 py-2 text-xs" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
                <option value="all">All Platforms</option>
                {platformOptions.map((platform) => (
                  <option key={platform} value={platform}>{platform}</option>
                ))}
              </select>
              <select className="rounded border border-slate-300 px-2 py-2 text-xs" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <select className="rounded border border-slate-300 px-2 py-2 text-xs" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option value="all">All Tags</option>
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag}>#{tag}</option>
                ))}
              </select>
              <select className="rounded border border-slate-300 px-2 py-2 text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | ComplaintItem['status'])}>
                <option value="all">All Status</option>
                <option value="open">open</option>
                <option value="escalated">escalated</option>
                <option value="resolved">resolved</option>
                <option value="rejected">rejected</option>
              </select>
              <select className="rounded border border-slate-300 px-2 py-2 text-xs" value={focusClusterId} onChange={(e) => setFocusClusterId(e.target.value)}>
                <option value="all">All Clusters</option>
                <option value="__unclustered__">Unclustered Only</option>
                {clusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>{cluster.name} ({cluster.complaint_count || 0})</option>
                ))}
              </select>
            </div>
            <button type="button" className="rounded border border-slate-300 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700" onClick={() => {
              setSearch('');
              setPlatformFilter('all');
              setCategoryFilter('all');
              setTagFilter('all');
              setStatusFilter('all');
              setFocusClusterId('all');
            }}>
              Reset Filters
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Selection & Actions</h3>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {selectedIds.length} selected / {visibleItems.length} visible
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Tags</p>
              <input
                className="mb-2 w-full rounded border border-slate-300 px-2 py-2 text-xs"
                placeholder="Type tag and press Enter"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTagChip(tagDraft);
                  }
                }}
              />
              <div className="mb-2 flex min-h-8 flex-wrap gap-1">
                {bulkTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700"
                    onClick={() => removeTagChip(tag)}
                  >
                    #{tag}
                    <span className="text-cyan-500">x</span>
                  </button>
                ))}
              </div>
              <button className="w-full rounded bg-slate-900 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={busy || selectedIds.length < 1} onClick={() => void assignTags()}>Assign Tags</button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Status</p>
              <div className="grid gap-2">
                <button className="rounded bg-amber-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={busy || selectedIds.length < 1} onClick={() => requestConfirm('Confirm Escalation', `Escalate ${selectedIds.length} selected complaint(s)?`, 'Escalate', async () => { await updateStatus('escalated'); })}>Mark Escalated</button>
                <button className="rounded bg-emerald-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={busy || selectedIds.length < 1} onClick={() => requestConfirm('Confirm Resolve', `Resolve ${selectedIds.length} selected complaint(s)?`, 'Resolve', async () => { await updateStatus('resolved'); })}>Approve (Resolve)</button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Cluster & Selection</p>
              <div className="grid gap-2">
                <button className="rounded bg-sky-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={busy || selectedIds.length < 1} onClick={() => { setClusterModalMode('full'); setShowClusterModal(true); }}>Add / Create Cluster</button>
                <button className="rounded bg-indigo-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={busy || visibleItems.length < 1} onClick={selectAllVisible}>Select All Visible</button>
                <button className="rounded bg-slate-700 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={busy || selectedIds.length < 1} onClick={() => setSelectedIds([])}>Clear Selection</button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Moderation Queue</h3>
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold" onClick={() => { void loadQueue(); void loadSpikes(); void loadClusters(); }}>Refresh Queue</button>
          </div>

          {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}
          {success && <p className="mb-2 text-sm font-medium text-emerald-700">{success}</p>}
          {loading && <p className="text-sm text-slate-600">Loading complaints...</p>}

          {!loading && visibleItems.length === 0 && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-600">
              No complaints match current filters.
            </p>
          )}

          <div className="space-y-4">
            {platformEntries.map(([platform, byCategory]) => {
              const categoryEntries = Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b));
              return (
                <div key={platform} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">{platform}</h4>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {categoryEntries.reduce((acc, [, arr]) => acc + arr.length, 0)} complaints
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {categoryEntries.map(([category, list]) => (
                      <div key={`${platform}-${category}`} className="rounded-lg border border-slate-200 bg-white p-2">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{category} ({list.length})</p>
                        <div className="space-y-2">
                          {list.map((item) => {
                            const displayName = item.is_anonymous ? 'Anonymous Worker' : (item.worker_name || `Worker ${String(item.worker_id || '').slice(0, 8)}`);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                draggable
                                onClick={() => toggleSelection(item.id)}
                                onDragStart={(e) => {
                                  beginDragComplaint(item.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragEnd={endDragComplaint}
                                className={`w-full rounded-lg border p-2 text-left transition ${selectedIds.includes(item.id) ? 'border-slate-900 bg-slate-100 ring-1 ring-slate-900/30' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-[11px] font-bold text-white">
                                      {item.is_anonymous ? 'AN' : initials(displayName)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-semibold text-slate-900">{displayName}</p>
                                      <p className="text-[11px] text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleString() : 'Unknown time'}</p>
                                    </div>
                                  </div>
                                  {item.cluster_id && (
                                    <button
                                      type="button"
                                      className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void uncluster(item.id);
                                      }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>

                                <p className="mt-2 line-clamp-3 text-xs text-slate-700">{item.description}</p>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusChipClass(item.status)}`}>
                                    {item.status}
                                  </span>
                                  {item.cluster_id && (
                                    <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                      {clusterNameMap[item.cluster_id] || 'Cluster'}
                                    </span>
                                  )}
                                  {(item.tags || []).map((tag) => (
                                    <span key={`${item.id}-${tag}`} className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">#{tag}</span>
                                  ))}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Clusters</h3>
          <div
            className="mt-2 rounded-lg border-2 border-dashed border-sky-300 bg-sky-50 p-2 text-xs text-sky-800"
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              setClusterModalMode('create-only');
              openCreateClusterFromDragDrop();
            }}
          >
            Drag complaints here to create a new cluster
          </div>
          <select className="mt-2 w-full rounded border border-slate-300 px-2 py-2 text-xs" value={existingClusterId} onChange={(e) => setExistingClusterId(e.target.value)}>
            <option value="all">All clusters</option>
            {clusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>{cluster.name} ({cluster.complaint_count || 0})</option>
            ))}
          </select>

          {existingClusterId !== 'all' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className="rounded bg-amber-500 px-2 py-1.5 text-xs font-semibold text-white" disabled={busy} onClick={() => requestConfirm('Confirm Cluster Escalation', 'Escalate all complaints in this cluster?', 'Escalate Cluster', async () => { await updateClusterStatus(existingClusterId, 'escalated'); })}>Escalate</button>
              <button type="button" className="rounded bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white" disabled={busy} onClick={() => requestConfirm('Confirm Cluster Resolve', 'Resolve all complaints in this cluster?', 'Resolve Cluster', async () => { await updateClusterStatus(existingClusterId, 'resolved'); })}>Resolve</button>
              <button type="button" className="col-span-2 rounded bg-rose-600 px-2 py-1.5 text-xs font-semibold text-white" disabled={busy} onClick={() => requestConfirm('Delete Cluster', 'Delete this cluster and uncluster all linked complaints?', 'Delete Cluster', async () => { await deleteCluster(existingClusterId); })}>Delete Cluster</button>
            </div>
          )}

          <div className="mt-3 max-h-[360px] space-y-2 overflow-auto">
            {clusters.map((cluster) => (
              <div
                key={cluster.id}
                className="rounded border border-slate-200 bg-slate-50 p-2"
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void addToExistingCluster(cluster.id);
                }}
              >
                <p className="text-xs font-semibold text-slate-800">{cluster.name}</p>
                <p className="text-[11px] text-slate-500">{cluster.primary_tag || 'untagged'} · {cluster.platform || 'mixed'} · {cluster.complaint_count || 0}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" className={`rounded px-2 py-1 text-[11px] font-semibold ${focusClusterId === cluster.id ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-800'}`} onClick={() => setFocusClusterId((prev) => (prev === cluster.id ? 'all' : cluster.id))}>{focusClusterId === cluster.id ? 'Unfocus' : 'Focus'}</button>
                  <button type="button" className="rounded bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white" disabled={busy} onClick={() => requestConfirm('Confirm Cluster Escalation', `Escalate cluster ${cluster.name}?`, 'Escalate', async () => { await updateClusterStatus(cluster.id, 'escalated'); })}>Escalate</button>
                  <button type="button" className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white" disabled={busy} onClick={() => requestConfirm('Confirm Cluster Resolve', `Resolve cluster ${cluster.name}?`, 'Resolve', async () => { await updateClusterStatus(cluster.id, 'resolved'); })}>Resolve</button>
                  <button type="button" className="rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white" disabled={busy} onClick={() => requestConfirm('Delete Cluster', `Delete cluster ${cluster.name} and uncluster linked complaints?`, 'Delete', async () => { await deleteCluster(cluster.id); })}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Spike Alerts (3h)</h3>
          <div className="mt-2 space-y-2">
            {spikes.length === 0 ? (
              <p className="text-xs text-slate-500">No major spikes detected.</p>
            ) : (
              spikes.slice(0, 8).map((spike) => (
                <div key={`${spike.platform}-${spike.category}`} className="rounded border border-amber-200 bg-amber-50 p-2">
                  <p className="text-xs font-semibold text-amber-900">{spike.platform} · {spike.category}</p>
                  <p className="text-[11px] text-amber-800">{spike.count} complaints in last 3h</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {showClusterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Cluster Actions ({selectedIds.length} selected)</h3>
              <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600" onClick={() => setShowClusterModal(false)}>Close</button>
            </div>

            <div className={`grid gap-4 ${clusterModalMode === 'full' ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
              {clusterModalMode === 'full' && (
                <section className="rounded-xl border border-slate-200 p-3">
                  <h4 className="text-sm font-semibold text-slate-900">Add to Existing Cluster</h4>
                  <input className="mt-2 w-full rounded border border-slate-300 px-2 py-2 text-xs" placeholder="Search cluster by name/platform/tag" value={clusterFilter} onChange={(e) => setClusterFilter(e.target.value)} />
                  <div className="mt-2 max-h-56 space-y-2 overflow-auto">
                    {filteredClusters.length === 0 ? (
                      <p className="text-xs text-slate-500">No clusters found.</p>
                    ) : (
                      filteredClusters.map((cluster) => (
                        <button
                          key={cluster.id}
                          type="button"
                          className={`w-full rounded border px-2 py-2 text-left text-xs ${existingClusterId === cluster.id ? 'border-slate-900 bg-slate-100' : 'border-slate-200 bg-white'}`}
                          onClick={() => setExistingClusterId(cluster.id)}
                        >
                          <p className="font-semibold text-slate-900">{cluster.name}</p>
                          <p className="text-[11px] text-slate-500">{cluster.primary_tag || 'untagged'} · {cluster.platform || 'mixed'} · {cluster.complaint_count || 0}</p>
                        </button>
                      ))
                    )}
                  </div>
                  <button type="button" className="mt-3 w-full rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={existingClusterId === 'all' || !existingClusterId || busy} onClick={() => void addToExistingCluster()}>
                    Add Selected To Chosen Cluster
                  </button>
                </section>
              )}

              <section className="rounded-xl border border-slate-200 p-3">
                <h4 className="text-sm font-semibold text-slate-900">Create New Cluster</h4>
                <input className="mt-2 w-full rounded border border-slate-300 px-2 py-2 text-xs" placeholder="Cluster name" value={clusterName} onChange={(e) => setClusterName(e.target.value)} />
                <select className="mt-2 w-full rounded border border-slate-300 px-2 py-2 text-xs" value={clusterTag} onChange={(e) => setClusterTag(e.target.value)}>
                  {clusterTagOptions.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-slate-500">Create a new cluster from one or more selected complaints.</p>
                <button type="button" className="mt-3 w-full rounded bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={busy || selectedIds.length < 1} onClick={() => void createCluster()}>
                  Create Cluster From Selected
                </button>
              </section>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">{confirmModal.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{confirmModal.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button
                type="button"
                className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                onClick={() => {
                  const action = confirmModal.action;
                  setConfirmModal(null);
                  void action();
                }}
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
