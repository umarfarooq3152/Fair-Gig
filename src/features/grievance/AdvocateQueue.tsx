import { useEffect, useMemo, useState } from 'react';
import { grievanceBases } from '../app/config';
import { fetchWithFallback, getErrorMessage } from '../app/helpers';
import type { ComplaintCluster, ComplaintItem, ComplaintSpike } from '../app/types';

type Props = {
  token: string;
};

export default function AdvocateQueue({ token }: Props) {
  const [items, setItems] = useState<ComplaintItem[]>([]);
  const [clusters, setClusters] = useState<ComplaintCluster[]>([]);
  const [spikes, setSpikes] = useState<ComplaintSpike[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clusterName, setClusterName] = useState('Systemic Issue Cluster');
  const [clusterTag, setClusterTag] = useState('payment_delay');
  const [existingClusterId, setExistingClusterId] = useState('');
  const [bulkTagsInput, setBulkTagsInput] = useState('');

  const selectedItems = useMemo(() => items.filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);
  const selectedClusterId = useMemo(() => {
    const clusterIds = Array.from(new Set(selectedItems.map((item) => item.cluster_id).filter(Boolean))) as string[];
    return clusterIds.length === 1 ? clusterIds[0] : '';
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

  async function assignTags() {
    const tags = bulkTagsInput.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (selectedIds.length < 1 || tags.length < 1) {
      setError('Select complaints and provide at least one tag');
      return;
    }

    await withBusy(async () => {
      const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/bulk/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ complaint_ids: selectedIds, tags }),
      });
      if (!response.ok) {
        setError(getErrorMessage(payload, 'Could not assign tags'));
        return;
      }
      setItems((prev) => prev.map((item) => (selectedIds.includes(item.id) ? { ...item, tags } : item)));
      setSelectedIds([]);
      setSuccess('Tags assigned');
    });
  }

  async function createCluster() {
    if (selectedIds.length < 2) {
      setError('Select at least two complaints');
      return;
    }

    await withBusy(async () => {
      const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          complaint_ids: selectedIds,
          name: clusterName,
          primary_tag: clusterTag,
          platform: selectedItems[0]?.platform || null,
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
      await loadClusters();
      setSuccess('Cluster created');
    });
  }

  async function addToExistingCluster() {
    if (!existingClusterId || selectedIds.length < 1) {
      setError('Select cluster and complaints first');
      return;
    }

    await withBusy(async () => {
      const { response, payload } = await fetchWithFallback(grievanceBases, `/complaints/cluster/${existingClusterId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ complaint_ids: selectedIds }),
      });
      if (!response.ok) {
        setError(getErrorMessage(payload, 'Could not add to cluster'));
        return;
      }
      const linkedIds: string[] = payload?.linked_complaint_ids || [];
      setItems((prev) => prev.map((item) => (linkedIds.includes(item.id) ? { ...item, cluster_id: existingClusterId } : item)));
      setSelectedIds([]);
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

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr,280px]">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Advocate Moderation Queue</h2>
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold" onClick={() => { void loadQueue(); void loadSpikes(); void loadClusters(); }}>Refresh Queue</button>
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          {success && <p className="text-sm font-medium text-emerald-700">{success}</p>}
          {loading ? <p className="text-sm text-slate-600">Loading...</p> : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[32px,150px,120px,1fr,130px,140px] gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <label className="flex items-center justify-center"><input type="checkbox" checked={items.length > 0 && selectedIds.length === items.length} onChange={(e) => setSelectedIds(e.target.checked ? items.map((item) => item.id) : [])} /></label>
                <span>Time</span><span>Platform</span><span>Preview</span><span>Status</span><span>Cluster</span>
              </div>
              <div className="max-h-[65vh] overflow-auto">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[32px,150px,120px,1fr,130px,140px] gap-2 border-b border-slate-100 px-2 py-2 text-xs text-slate-700">
                    <label className="flex items-start justify-center pt-1"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds((prev) => (prev.includes(item.id) ? prev.filter((v) => v !== item.id) : [...prev, item.id]))} /></label>
                    <div><p>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</p><p className="truncate text-[11px] text-slate-500">{item.worker_name || item.worker_id || 'Unknown'}</p></div>
                    <div><p className="font-semibold text-slate-800">{item.platform}</p><p className="text-[11px] text-slate-500">{item.category}</p></div>
                    <div className="space-y-1"><p className="truncate font-semibold text-slate-900">{item.description.slice(0, 90)}</p><p className="truncate text-[11px] text-slate-500">{(item.tags || []).join(', ') || 'No tags'}</p></div>
                    <div><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${item.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : item.status === 'escalated' ? 'bg-amber-100 text-amber-800' : item.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>{item.status}</span></div>
                    <div className="space-y-1"><p className="truncate text-[11px] text-slate-500">{item.cluster_id || 'Unclustered'}</p>{item.cluster_id && <button className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700" onClick={() => void uncluster(item.id)}>Remove</button>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Spike Alert (3h)</h3>
            <div className="mt-2 space-y-2">
              {spikes.length === 0 ? <p className="text-xs text-slate-500">No major spikes detected.</p> : spikes.slice(0, 8).map((spike) => (
                <div key={`${spike.platform}-${spike.category}`} className="rounded border border-amber-200 bg-amber-50 p-2">
                  <p className="text-xs font-semibold text-amber-900">{spike.platform} · {spike.category}</p>
                  <p className="text-[11px] text-amber-800">{spike.count} complaints in last 3h</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Existing Clusters</h3>
            <select className="mt-2 w-full rounded border border-slate-300 px-2 py-2 text-xs" value={existingClusterId} onChange={(e) => setExistingClusterId(e.target.value)}>
              <option value="">Select cluster</option>
              {clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name} ({cluster.complaint_count || 0})</option>)}
            </select>
          </section>
        </aside>
      </div>

      {selectedIds.length > 0 && (
        <section className="sticky bottom-3 z-20 rounded-xl border border-slate-900 bg-slate-950 p-3 shadow-xl">
          <p className="mb-2 text-sm font-semibold text-white">{selectedIds.length} selected</p>
          <div className="grid gap-2 md:grid-cols-6">
            <input className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100" placeholder="Assign tags (comma-separated)" value={bulkTagsInput} onChange={(e) => setBulkTagsInput(e.target.value)} />
            <button className="rounded bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-900 disabled:opacity-60" disabled={busy} onClick={() => void assignTags()}>Assign Tags</button>
            <input className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100" placeholder="New cluster name" value={clusterName} onChange={(e) => setClusterName(e.target.value)} />
            <input className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100" placeholder="Primary tag" value={clusterTag} onChange={(e) => setClusterTag(e.target.value)} />
            <button className="rounded bg-sky-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void createCluster()}>Create Cluster</button>
            <button className="rounded bg-slate-700 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void addToExistingCluster()}>Add To Existing</button>
            <button className="rounded bg-amber-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void updateStatus('escalated')}>Mark Escalated</button>
            <button className="rounded bg-emerald-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void updateStatus('resolved')}>Mark Resolved</button>
          </div>
        </section>
      )}
    </section>
  );
}
