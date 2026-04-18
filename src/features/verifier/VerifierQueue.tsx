import { useEffect, useMemo, useState } from 'react';
import { earningsBases, verifierBases } from '../app/config';
import { fetchWithFallback, getErrorMessage } from '../app/helpers';
import type { Shift, VerifierQueueItem } from '../app/types';

type Props = {
  verifierId: string;
};

export default function VerifierQueue({ verifierId }: Props) {
  const [queue, setQueue] = useState<VerifierQueueItem[]>([]);
  const [reviewed, setReviewed] = useState<Shift[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest');

  const filteredQueue = useMemo(() => {
    const workerNeedle = workerFilter.trim().toLowerCase();
    const filtered = queue.filter((item) => {
      const matchPlatform = platformFilter === 'all' || item.platform === platformFilter;
      const matchWorker = !workerNeedle || item.worker_name.toLowerCase().includes(workerNeedle);
      return matchPlatform && matchWorker;
    });

    filtered.sort((a, b) => {
      const left = new Date(a.submitted_at || a.shift_date).getTime();
      const right = new Date(b.submitted_at || b.shift_date).getTime();
      return sortOrder === 'newest' ? right - left : left - right;
    });

    return filtered;
  }, [platformFilter, queue, sortOrder, workerFilter]);

  const platformOptions = useMemo(
    () => Array.from(new Set(queue.map((item) => item.platform))).sort((a, b) => a.localeCompare(b)),
    [queue],
  );

  const grouped = useMemo(() => {
    const groupedByWorker: Record<string, VerifierQueueItem[]> = {};
    for (const item of filteredQueue) {
      const key = `${item.worker_name} (${item.worker_id.slice(0, 8)})`;
      if (!groupedByWorker[key]) groupedByWorker[key] = [];
      groupedByWorker[key].push(item);
    }
    return groupedByWorker;
  }, [filteredQueue]);

  async function load() {
    setError('');
    const { response, payload } = await fetchWithFallback(earningsBases, '');
    if (!response.ok) {
      setError(getErrorMessage(payload, 'Could not load shifts'));
      return;
    }
    const allShifts = Array.isArray(payload) ? payload : [];
    setQueue(
      allShifts
        .filter((s: Shift) => s.verification_status === 'pending')
        .map((s: Shift): VerifierQueueItem => ({
          shift_id: s.id,
          worker_id: s.worker_id || 'unknown',
          worker_name: s.worker_name || 'Unknown Worker',
          city_zone: null,
          category: null,
          platform: s.platform,
          shift_date: s.shift_date,
          hours_worked: s.hours_worked,
          gross_earned: s.gross_earned,
          platform_deductions: s.platform_deductions,
          net_received: s.net_received,
          deduction_rate: Number(s.deduction_rate || 0),
          screenshot_url: s.screenshot_url || null,
          submitted_at: s.created_at || s.shift_date,
        })),
    );
    setReviewed(allShifts.filter((s: Shift) => s.verifier_id === verifierId && s.verification_status !== 'pending'));
  }

  useEffect(() => {
    void load();
  }, [verifierId]);

  async function decide(shiftId: string, status: 'verified' | 'flagged' | 'unverifiable') {
    setLoadingId(shiftId);
    setError('');
    setSuccess('');

    const { response, payload } = await fetchWithFallback(verifierBases, `/${shiftId}/decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        verifier_id: verifierId,
        verifier_note: notes[shiftId] || '',
      }),
    });

    setLoadingId(null);
    if (!response.ok) {
      setError(getErrorMessage(payload, 'Could not update verification decision'));
      return;
    }

    setSuccess(`Shift ${status} successfully`);
    await load();
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-slate-900">Pending Worker Entries</h2>
        <div className="mb-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
          >
            <option value="all">All Platforms</option>
            {platformOptions.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>

          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Filter by worker name"
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
          />

          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'oldest' | 'newest')}
          >
            <option value="oldest">Oldest First</option>
            <option value="newest">Newest First</option>
          </select>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-slate-600">No pending entries for current filters.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([workerLabel, entries]) => (
              <div key={workerLabel} className="rounded-xl border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-800">{workerLabel}</h3>
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <div key={entry.shift_id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 sm:grid-cols-3">
                        <div>Date: {entry.shift_date}</div>
                        <div>Platform: {entry.platform}</div>
                        <div>Hours: {entry.hours_worked}</div>
                        <div>Gross: PKR {Number(entry.gross_earned).toFixed(2)}</div>
                        <div>Deduction: PKR {Number(entry.platform_deductions).toFixed(2)}</div>
                        <div>Net: PKR {Number(entry.net_received).toFixed(2)}</div>
                      </div>

                      {entry.screenshot_url ? (
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            type="button"
                            className="overflow-hidden rounded-lg border border-slate-300 bg-white"
                            onClick={() => window.open(entry.screenshot_url || '', '_blank', 'noopener,noreferrer')}
                          >
                            <img src={entry.screenshot_url} alt="Shift proof" className="h-20 w-32 object-cover" />
                          </button>
                          <a
                            href={entry.screenshot_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-emerald-700 underline"
                          >
                            Open full image
                          </a>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No screenshot uploaded</p>
                      )}

                      <textarea className="mt-2 min-h-14 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" placeholder="Add verifier note (optional)" value={notes[entry.shift_id] || ''} onChange={(e) => setNotes((prev) => ({ ...prev, [entry.shift_id]: e.target.value }))} />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" disabled={loadingId === entry.shift_id} onClick={() => void decide(entry.shift_id, 'verified')}>Approve</button>
                        <button className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" disabled={loadingId === entry.shift_id} onClick={() => void decide(entry.shift_id, 'flagged')}>Flag</button>
                        <button className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" disabled={loadingId === entry.shift_id} onClick={() => void decide(entry.shift_id, 'unverifiable')}>Unverifiable</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-slate-900">My Reviewed Entries</h2>
        {reviewed.length === 0 ? <p className="text-sm text-slate-600">No entries reviewed by you yet.</p> : (
          <ul className="space-y-2 text-xs text-slate-700">
            {reviewed.slice(0, 20).map((entry) => (
              <li key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{entry.shift_date} • {entry.platform} • Net PKR {Number(entry.net_received).toFixed(2)}</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold capitalize">{entry.verification_status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm font-medium text-emerald-700">{success}</p>}
      </section>
    </section>
  );
}
