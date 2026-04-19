'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE, authFetch } from '@/lib/api';
import {
  Search,
  RefreshCw,
  AlertCircle,
  Tag as TagIcon,
  Link as LinkIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  ChevronDown,
  User,
  Clock,
  Loader2,
  Trash2,
  Check,
  Save,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<AdvocateComplaint[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clusterName, setClusterName] = useState('Systemic Issue Cluster');
  const [clusterTag, setClusterTag] = useState('payment_delay');
  const [existingClusterId, setExistingClusterId] = useState('');
  const [targetClusterId, setTargetClusterId] = useState('');
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [draftTagsById, setDraftTagsById] = useState<Record<string, string[]>>({});
  const [rowTagInputById, setRowTagInputById] = useState<Record<string, string>>({});
  const [draggedComplaintIds, setDraggedComplaintIds] = useState<string[]>([]);
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [clusterModalName, setClusterModalName] = useState('');
  const [clusterModalComplaintIds, setClusterModalComplaintIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [spikes, setSpikes] = useState<SpikeItem[]>([]);
  const [activeSpikeFilter, setActiveSpikeFilter] = useState<{ platform: string; category: string } | null>(null);

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

  const clusterNameById = useMemo(() => {
    const map = new Map<string, string>();
    clusters.forEach((cluster) => {
      map.set(cluster.id, cluster.name);
    });
    return map;
  }, [clusters]);

  const visibleItems = useMemo(() => {
    let rows = items;

    if (existingClusterId) {
      rows = rows.filter((item) => item.cluster_id === existingClusterId);
    }

    if (activeSpikeFilter) {
      rows = rows.filter(
        (item) =>
          item.platform.toLowerCase() === activeSpikeFilter.platform.toLowerCase() &&
          item.category.toLowerCase() === activeSpikeFilter.category.toLowerCase(),
      );
    }

    return rows;
  }, [items, existingClusterId, activeSpikeFilter]);

  const newestTimestamp = useMemo(() => items[0]?.created_at || '', [items]);
  const selectedCount = selectedIds.length;

  useEffect(() => {
    const visibleIds = new Set(visibleItems.map((item) => item.id));
    setSelectedIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [visibleItems]);

  function normalizeTag(value: string) {
    return value.trim().replace(/^#/, '').replace(/\s+/g, '_').toLowerCase();
  }

  function getRowTags(item: AdvocateComplaint) {
    return draftTagsById[item.id] ?? (item.tags || []);
  }

  function hasPendingTagChanges(item: AdvocateComplaint) {
    return JSON.stringify(getRowTags(item)) !== JSON.stringify(item.tags || []);
  }

  function pushRowTag(id: string, raw: string) {
    const tag = normalizeTag(raw);
    if (!tag) return;
    setDraftTagsById((prev) => {
      const current = prev[id] ?? (items.find((row) => row.id === id)?.tags || []);
      if (current.includes(tag)) return prev;
      return { ...prev, [id]: [...current, tag] };
    });
  }

  function removeRowTag(id: string, tag: string) {
    setDraftTagsById((prev) => {
      const current = prev[id] ?? (items.find((row) => row.id === id)?.tags || []);
      return { ...prev, [id]: current.filter((entry) => entry !== tag) };
    });
  }

  async function saveRowTags(item: AdvocateComplaint) {
    const nextTags = getRowTags(item);
    if (!hasPendingTagChanges(item)) return;
    await moderateComplaint(item.id, { tags: nextTags });
    setDraftTagsById((prev) => {
      const copy = { ...prev };
      delete copy[item.id];
      return copy;
    });
  }

  function addBulkTag(raw: string) {
    const parsed = raw
      .split(/[\n,]/)
      .map(normalizeTag)
      .filter(Boolean);
    if (!parsed.length) return;
    setBulkTags((prev) => Array.from(new Set([...prev, ...parsed])));
  }

  function activeDragIds(fallbackId?: string) {
    if (draggedComplaintIds.length) return draggedComplaintIds;
    if (selectedIds.length) return selectedIds;
    return fallbackId ? [fallbackId] : [];
  }

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
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/alerts/spikes?window_hours=3&min_count=10`);
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
    setMounted(true);
  }, []);

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
    setSelectedIds(visibleItems.map((item) => item.id));
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
    if (selectedIds.length < 1) {
      setError('Select at least one complaint to create a cluster');
      return;
    }
    setClusterModalComplaintIds(selectedIds);
    setClusterModalName(clusterName || '');
    setShowClusterModal(true);
  }

  async function addComplaintsToCluster(clusterId: string, complaintIds: string[]) {
    if (!clusterId) {
      setError('Choose an existing cluster first');
      return;
    }
    if (complaintIds.length < 1) {
      setError('Select at least one complaint to add to a cluster');
      return;
    }

    setError('');
    setMessage('');
    setActionBusy(true);

    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/cluster/${clusterId}/add`, {
        method: 'POST',
        body: JSON.stringify({ complaint_ids: complaintIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not add complaints to cluster');
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          data.linked_complaint_ids?.includes(item.id)
            ? { ...item, cluster_id: clusterId }
            : item,
        ),
      );
      setMessage(`Added ${data.linked_count} complaints to selected cluster.`);
      setSelectedIds((prev) => prev.filter((id) => !complaintIds.includes(id)));
      await loadClusters();
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      setActionBusy(false);
    }
  }

  async function addToExistingCluster() {
    await addComplaintsToCluster(targetClusterId, selectedIds);
  }

  async function createClusterByName(name: string, complaintIds: string[]) {
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Cluster name is required');
      return;
    }
    if (complaintIds.length < 1) {
      setError('Select at least one complaint to create a cluster');
      return;
    }

    const sameNameCluster = clusters.find((cluster) => cluster.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (sameNameCluster) {
      await addComplaintsToCluster(sameNameCluster.id, complaintIds);
      setTargetClusterId(sameNameCluster.id);
      return;
    }

    setError('');
    setMessage('');
    setActionBusy(true);
    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/cluster`, {
        method: 'POST',
        body: JSON.stringify({
          complaint_ids: complaintIds,
          name: cleanName,
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
      setTargetClusterId(data.cluster.id);
      setMessage(`Cluster created. Linked ${data.linked_count} complaints.`);
      setSelectedIds((prev) => prev.filter((id) => !complaintIds.includes(id)));
      await loadClusters();
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      setActionBusy(false);
    }
  }

  async function setClusterCascadeStatus(clusterId: string, status: 'escalated' | 'resolved') {
    setActionBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/cluster/${clusterId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not update cluster status');
        return;
      }
      setItems((prev) => prev.map((item) => (item.cluster_id === clusterId ? { ...item, status } : item)));
      setMessage(`Cluster ${status} applied to ${data.affected_count} complaints.`);
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      setActionBusy(false);
    }
  }

  async function deleteCluster(clusterId: string) {
    setActionBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await authFetch(`${API_BASE.grievance}/api/complaints/cluster/${clusterId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not delete cluster');
        return;
      }
      setItems((prev) => prev.map((item) => (item.cluster_id === clusterId ? { ...item, cluster_id: null } : item)));
      if (existingClusterId === clusterId) setExistingClusterId('');
      if (targetClusterId === clusterId) setTargetClusterId('');
      setMessage('Cluster deleted and complaints detached.');
      await loadClusters();
    } catch {
      setError('Could not connect to grievance service');
    } finally {
      setActionBusy(false);
    }
  }

  async function assignTagsToSelected() {
    const tags = Array.from(new Set([
      ...bulkTags,
      ...bulkTagInput.split(/[\n,]/).map(normalizeTag).filter(Boolean),
    ]));

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
      setBulkTagInput('');
      setBulkTags([]);
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

  async function saveClusterModal() {
    const ids = clusterModalComplaintIds.length ? clusterModalComplaintIds : selectedIds;
    await createClusterByName(clusterModalName || clusterName, ids);
    setShowClusterModal(false);
    setClusterModalName('');
    setClusterModalComplaintIds([]);
  }

  function statusBadge(status: AdvocateComplaint['status']) {
    switch (status) {
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Resolved
          </span>
        );
      case 'escalated':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" /> Escalated
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 border border-rose-500/20">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-500/20">
            <Clock className="h-3 w-3" /> Open
          </span>
        );
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-24">
      {/* Header Area */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Grievance Intelligence</h1>
          <p className="text-slate-500 mt-1">Monitor, moderate and cluster workforce complaints across all regions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="group flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
            onClick={() => {
              void loadFeed(true);
              void loadSpikeAlerts();
            }}
          >
            <RefreshCw className={`h-4 w-4 text-slate-400 group-hover:rotate-180 transition-transform duration-500`} />
            Sync Queue
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,320px]">
        {/* Main Feed Section */}
        <div className="space-y-4">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all">
            {/* Toolbar */}
            <div className="border-b border-slate-100 bg-slate-50/50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search complaints, names, keywords..."
                    className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 hover:border-slate-300 transition-all cursor-pointer"
                    value={filters.platform}
                    onChange={(e) => setFilters((prev) => ({ ...prev, platform: e.target.value }))}
                  >
                    <option value="all text-slate-400">All Platforms</option>
                    {platformOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>

                  <select
                    className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 hover:border-slate-300 transition-all cursor-pointer"
                    value={filters.category}
                    onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>

                  <select
                    className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 hover:border-slate-300 transition-all cursor-pointer"
                    value={filters.status}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="all">All Statuses</option>
                    {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

            </div>

            {error && (
              <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600 border border-rose-100">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}

            {message && (
              <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700 border border-emerald-100">
                <CheckCircle2 className="h-4 w-4" /> {message}
              </div>
            )}

            {/* Table Header */}
            <div className="grid grid-cols-[40px,170px,130px,1fr,190px] items-center gap-4 bg-slate-50/80 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-100">
              <div className="flex justify-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                  checked={visibleItems.length > 0 && selectedIds.length === visibleItems.length}
                  onChange={(e) => toggleAllVisible(e.target.checked)}
                />
              </div>
              <span>Reporter & Time</span>
              <span>Classification</span>
              <span>Testimony & Evidence</span>
              <span>Tags & Labeling</span>
            </div>

            <div className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {loadingInitial ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="text-sm font-medium">Analyzing records...</p>
                  </div>
                ) : visibleItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-2 text-slate-400">
                    <div className="rounded-full bg-slate-100 p-4">
                      <Search className="h-8 w-8" />
                    </div>
                    <p className="text-sm font-medium mt-2 text-slate-500">
                      {existingClusterId
                        ? 'No incidents found in the focused cluster.'
                        : 'No matching incidents found.'}
                    </p>
                    <p className="text-xs">
                      {existingClusterId
                        ? 'Unfocus the cluster to view all complaints again.'
                        : 'Adjust your filters to see more data.'}
                    </p>
                  </div>
                ) : (
                  visibleItems.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`group grid grid-cols-[40px,170px,130px,1fr,190px] items-start gap-4 px-4 py-4 transition-colors hover:bg-slate-50/50 ${selectedIds.includes(item.id) ? 'bg-blue-50/30' : ''}`}
                      onClick={(event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest('button,input,textarea,select,a,label')) return;
                        toggleRow(item.id);
                      }}
                      draggable
                      onDragStart={() => {
                        setDraggedComplaintIds(activeDragIds(item.id));
                      }}
                      onDragEnd={() => {
                        setDraggedComplaintIds([]);
                      }}
                    >
                      <div className="flex justify-center pt-1">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleRow(item.id)}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-[13px]">
                          <User className="h-3 w-3 text-slate-400" />
                          {item.worker_name}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="h-3 w-3" />
                          {new Date(item.created_at).toLocaleDateString('en-GB')} · {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                          {item.platform}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 capitalize leading-none">
                          {item.category.replace(/_/g, ' ')}
                        </p>
                        {statusBadge(item.status)}
                      </div>

                      <div className="space-y-2 pr-4 min-w-0 flex-1">
                        <textarea
                          className="block w-full rounded-xl border-transparent bg-slate-100/50 px-3 py-2 text-[12px] text-slate-700 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/30 hover:bg-slate-100 min-h-[60px] resize-none overflow-hidden"
                          defaultValue={item.description}
                          onBlur={(e) => {
                            if (e.target.value !== item.description) {
                              void moderateComplaint(item.id, { description: e.target.value });
                            }
                          }}
                        />
                        {item.cluster_id ? (
                          <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                            <Layers className="h-3 w-3" />
                            <span>{clusterNameById.get(item.cluster_id) || 'Unknown cluster'}</span>
                            <button
                              type="button"
                              className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-md text-base leading-none text-blue-600 hover:bg-blue-100 hover:text-blue-900"
                              onClick={() => void unclusterComplaint(item.id)}
                              aria-label="Remove from cluster"
                              title="Remove from cluster"
                            >
                              ×
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {getRowTags(item).length > 0 ? (
                            getRowTags(item).map((t) => (
                              <span key={t} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold uppercase tracking-wider border border-blue-100">
                                #{t}
                                <button
                                  type="button"
                                  className="ml-1 text-blue-400 hover:text-blue-700"
                                  onClick={() => removeRowTag(item.id, t)}
                                  aria-label={`Remove ${t}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">No labels</span>
                          )}
                        </div>
                        <div className="relative">
                          <TagIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                          <input
                            className="w-full pl-6 pr-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder="Add tag..."
                            value={rowTagInputById[item.id] || ''}
                            onChange={(e) => {
                              setRowTagInputById((prev) => ({ ...prev, [item.id]: e.target.value }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              pushRowTag(item.id, rowTagInputById[item.id] || '');
                              setRowTagInputById((prev) => ({ ...prev, [item.id]: '' }));
                            }}
                          />
                        </div>
                        {hasPendingTagChanges(item) ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"
                            onClick={() => void saveRowTags(item)}
                          >
                            <Save className="h-3 w-3" /> Save
                          </button>
                        ) : null}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {hasMore && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/30">
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-all"
                  disabled={loadingMore}
                  onClick={() => void loadFeed(false)}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading batch...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Load Historical Data
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Intelligence Sidebar */}
        <aside className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/50">
            <div className="bg-amber-500/5 p-4 border-b border-amber-500/10 flex items-center gap-2">
              <div className="rounded-full bg-amber-500 p-1">
                <AlertTriangle className="h-3 w-3 text-white" />
              </div>
              <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wider">Live Spikes</h2>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[11px] font-medium text-slate-500 leading-relaxed">Shows only spikes with 10+ complaints for the same provider and issue category (last 3 hours).</p>

              {activeSpikeFilter ? (
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px]">
                  <span className="font-semibold text-amber-900">
                    Focused: {activeSpikeFilter.platform} · {activeSpikeFilter.category.replace(/_/g, ' ')}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-amber-300 px-2 py-1 font-bold text-amber-800 hover:bg-amber-100"
                    onClick={() => setActiveSpikeFilter(null)}
                  >
                    Unfocus
                  </button>
                </div>
              ) : null}

              {spikes.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-center border border-dashed border-slate-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-2 opacity-30" />
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Normal Activity</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {spikes.map((spike) => (
                    <motion.div
                      key={`${spike.platform}-${spike.category}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`group p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                        activeSpikeFilter?.platform.toLowerCase() === spike.platform.toLowerCase() &&
                        activeSpikeFilter?.category.toLowerCase() === spike.category.toLowerCase()
                          ? 'border-amber-400 bg-amber-100'
                          : 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
                      }`}
                      onClick={() => {
                        setActiveSpikeFilter((prev) => {
                          if (
                            prev &&
                            prev.platform.toLowerCase() === spike.platform.toLowerCase() &&
                            prev.category.toLowerCase() === spike.category.toLowerCase()
                          ) {
                            return null;
                          }
                          return { platform: spike.platform, category: spike.category };
                        });
                      }}
                    >
                      <div className="relative z-10 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-bold text-amber-900 uppercase tracking-tight">{spike.platform} · {spike.category.replace(/_/g, ' ')}</p>
                          <p className="text-[13px] font-black text-amber-700 mt-1">{spike.count} Alerts</p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-amber-600">3h</span>
                        </div>
                      </div>
                      <div className="absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-amber-500/5 to-transparent pointer-none" />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/50">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-500" />
              <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wider">Reference Clusters</h2>
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  setClusterModalComplaintIds(selectedIds);
                  setClusterModalName('');
                  setShowClusterModal(true);
                }}
              >
                <Plus className="h-3 w-3" /> Add New
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[11px] font-medium text-slate-500 leading-relaxed">Click cluster actions directly. Drag selected incidents onto a cluster card to add them.</p>

              {clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className={`rounded-xl border p-3 transition-colors ${existingClusterId === cluster.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => void addComplaintsToCluster(cluster.id, activeDragIds())}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{cluster.name}</p>
                      <p className="text-[10px] text-slate-500">{cluster.complaint_count} complaint(s)</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600"
                      onClick={() => {
                        setExistingClusterId((prev) => (prev === cluster.id ? '' : cluster.id));
                        setTargetClusterId(cluster.id);
                      }}
                    >
                      {existingClusterId === cluster.id ? 'Unfocus' : 'Focus'}
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700"
                      onClick={() => void setClusterCascadeStatus(cluster.id, 'escalated')}
                    >
                      Escalate
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-700"
                      onClick={() => void setClusterCascadeStatus(cluster.id, 'resolved')}
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-700"
                      onClick={() => void addComplaintsToCluster(cluster.id, selectedIds)}
                    >
                      Add Selected
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-700"
                      onClick={() => void deleteCluster(cluster.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              <div
                className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-[11px] font-semibold text-slate-500"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  const ids = activeDragIds();
                  if (!ids.length) return;
                  setClusterModalComplaintIds(ids);
                  setClusterModalName('');
                  setShowClusterModal(true);
                }}
              >
                Drop here to create a new cluster from selected incidents
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Premium Multi-Action Tray */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-50 w-full max-w-5xl px-4"
          >
            <div className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-950 p-1.5 shadow-2xl shadow-blue-900/40 border-t-slate-800">
              <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                {/* Selection Counter */}
                <div className="flex shrink-0 items-center justify-between border-r border-white/10 pr-4 sm:justify-start">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 font-extrabold text-white shadow-lg shadow-blue-600/20">
                      {selectedCount}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">Incidents</p>
                      <p className="text-[10px] text-slate-400 font-medium">Capture Session</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ml-4 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-slate-400"
                    onClick={() => setSelectedIds([])}
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>

                {/* Tags Action */}
                <div className="flex flex-1 flex-wrap items-center gap-3 px-2">
                  <div className="flex min-w-[220px] flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1">
                      {bulkTags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                          #{tag}
                          <button
                            type="button"
                            onClick={() => setBulkTags((prev) => prev.filter((entry) => entry !== tag))}
                            className="text-blue-200 hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                    <TagIcon className="h-3 w-3 text-slate-500" />
                    <input
                      className="w-full bg-transparent text-[12px] font-medium text-white placeholder:text-slate-600 focus:outline-none"
                      placeholder="Enter bulk labels..."
                      value={bulkTagInput}
                      onChange={(e) => setBulkTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        addBulkTag(bulkTagInput);
                        setBulkTagInput('');
                      }}
                    />
                  </div>
                  </div>
                  <div className="h-6 w-px bg-white/10 hidden md:block" />

                  <button
                    type="button"
                    className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-200 hover:bg-blue-500/20"
                    onClick={() => void assignTagsToSelected()}
                  >
                    Apply Tags
                  </button>

                  {/* Status Group */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="group relative flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-500 hover:bg-amber-500 hover:text-white transition-all disabled:opacity-30"
                      onClick={() => void updateSelectedStatus('escalated')}
                      disabled={actionBusy}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      ESCALATE
                    </button>
                    <button
                      type="button"
                      className="group relative flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-30"
                      onClick={() => void updateSelectedStatus('resolved')}
                      disabled={actionBusy}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      RESOLVE
                    </button>
                  </div>

                  <div className="h-6 w-px bg-white/10 hidden xl:block" />

                  {/* Cluster Area */}
                  <div className="flex flex-1 items-center gap-2">
                    <div className="hidden lg:flex flex-1 items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5 focus-within:bg-white/10 transition-colors">
                      <Layers className="h-3 w-3 text-slate-500" />
                      <select
                        className="w-full bg-transparent text-[11px] font-medium text-white focus:outline-none"
                        value={targetClusterId}
                        onChange={(e) => setTargetClusterId(e.target.value)}
                      >
                        <option value="">Systemic Issue Cluster</option>
                        {clusters.map((cluster) => (
                          <option key={cluster.id} value={cluster.id} className="text-slate-900">
                            {cluster.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="group flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[11px] font-black text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 disabled:opacity-40 transition-all active:scale-95"
                      onClick={() => {
                        if (targetClusterId) {
                          void addComplaintsToCluster(targetClusterId, selectedIds);
                          return;
                        }
                        void createClusterFromSelected();
                      }}
                      disabled={actionBusy}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      SAVE IN CLUSTER
                    </button>

                    <button
                      type="button"
                      className="group flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 transition-all disabled:opacity-30"
                      onClick={() => void addToExistingCluster()}
                      disabled={actionBusy || !targetClusterId}
                      title="Merge into Focus Cluster"
                    >
                      <LinkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mounted && showClusterModal
          ? createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4"
            >
              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 12, opacity: 0 }}
                className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
              >
                <h3 className="text-lg font-bold text-slate-900">Create New Cluster</h3>
                <p className="mt-1 text-sm text-slate-500">Name your cluster and save selected complaints.</p>
                <input
                  className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Cluster name"
                  value={clusterModalName}
                  onChange={(e) => setClusterModalName(e.target.value)}
                />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                    onClick={() => {
                      setShowClusterModal(false);
                      setClusterModalName('');
                      setClusterModalComplaintIds([]);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => void saveClusterModal()}
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            </motion.div>,
            document.body,
          )
          : null}
      </AnimatePresence>
    </div>
  );
}
