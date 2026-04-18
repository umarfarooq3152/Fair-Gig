import { useState } from 'react';
import { anomalyBases, earningsBases } from '../app/config';
import { fetchWithFallback, getErrorMessage } from '../app/helpers';

type Props = {
  workerId: string;
};

export default function AnomalyInsights({ workerId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  async function runAnalysis() {
    setLoading(true);
    setError('');
    try {
      const { response: shiftsRes, payload: shiftsPayload } = await fetchWithFallback(
        earningsBases,
        `?worker_id=${encodeURIComponent(workerId)}`,
      );
      if (!shiftsRes.ok) {
        setError(getErrorMessage(shiftsPayload, 'Could not load worker shifts for anomaly analysis'));
        return;
      }

      const earnings = Array.isArray(shiftsPayload)
        ? shiftsPayload
            .map((s: any) => {
              const rawDate = String(s?.shift_date || '').trim();
              const shiftDate = rawDate.includes('T') ? rawDate.slice(0, 10) : rawDate;
              const gross = Number(s?.gross_earned ?? 0);
              const deductions = Number(s?.platform_deductions ?? 0);
              const net = Number(s?.net_received ?? 0);
              const hours = Number(s?.hours_worked ?? 0);

              return {
                shift_date: shiftDate,
                platform: String(s?.platform || 'Other'),
                gross_earned: Number.isFinite(gross) && gross >= 0 ? gross : 0,
                platform_deductions: Number.isFinite(deductions) && deductions >= 0 ? deductions : 0,
                net_received: Number.isFinite(net) && net >= 0 ? net : 0,
                hours_worked: Number.isFinite(hours) && hours >= 0 ? hours : 0,
              };
            })
            .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.shift_date))
        : [];

      const { response, payload } = await fetchWithFallback(anomalyBases, '/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: workerId, earnings }),
      });

      if (!response.ok) {
        setError(getErrorMessage(payload, 'Failed to analyze anomalies'));
        return;
      }
      setResult(payload);
    } catch {
      setError('Could not connect to anomaly service');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Anomaly Insights</h2>
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={() => void runAnalysis()}>
          {loading ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {!result ? (
        <p className="text-sm text-slate-600">Run anomaly detection to inspect unusual drops, spikes, or deduction patterns.</p>
      ) : (
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-200">{JSON.stringify(result, null, 2)}</pre>
      )}
    </section>
  );
}
