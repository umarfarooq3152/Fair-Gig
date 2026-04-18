import { useState } from 'react';

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
      const response = await fetch('/api/anomaly/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: workerId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.detail || 'Failed to analyze anomalies');
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
