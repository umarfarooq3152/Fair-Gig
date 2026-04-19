'use client';

import { useMemo } from 'react';
import type { TagClusterRow } from '@/features/advocate/types';
import { platformColor } from '@/features/advocate/chart-helpers';

export function TagClusterBubbles({ rows }: { rows: TagClusterRow[] }) {
  const bubbles = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.complaint_count - a.complaint_count).slice(0, 18);
    const counts = sorted.map((r) => r.complaint_count);
    const max = Math.max(...counts, 1);
    const min = Math.min(...counts);
    return sorted.map((r) => {
      const t = max === min ? 0.5 : (r.complaint_count - min) / (max - min);
      const size = 52 + t * 56;
      return { ...r, size };
    });
  }, [rows]);

  if (!bubbles.length) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
        No tagged grievance clusters yet. Tags appear when advocates label complaints.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-6">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
        Platform × primary tag
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {bubbles.map((b) => (
          <div
            key={`${b.primary_tag}-${b.platform}`}
            className="flex flex-col items-center justify-center text-center"
            style={{ width: b.size + 24 }}
          >
            <div
              className="flex flex-col items-center justify-center rounded-full border-2 border-white shadow-md transition-transform hover:scale-105"
              style={{
                width: b.size,
                height: b.size,
                backgroundColor: `${platformColor(b.platform)}22`,
                borderColor: platformColor(b.platform),
              }}
            >
              <span className="text-lg font-bold leading-none text-slate-900">{b.complaint_count}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-[11px] font-medium text-slate-700">{b.primary_tag}</p>
            <p className="text-[10px] text-slate-500">{b.platform}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
