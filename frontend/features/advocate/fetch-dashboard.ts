import { API_BASE, authFetch } from '@/lib/api';
import type {
  AdvocateDashboardPayload,
  AdvocateSummary,
  CommissionTrendRow,
  IncomeZoneCategoryRow,
  TagClusterRow,
  TopComplaintRow,
  VulnerabilityRow,
} from './types';

async function safeJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function loadAdvocateDashboard(): Promise<AdvocateDashboardPayload> {
  const errors: string[] = [];
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    summaryRes,
    commissionRes,
    incomeZCRes,
    topRes,
    vulnRes,
    clustersRes,
    inboxRes,
  ] = await Promise.all([
    fetch(`${API_BASE.analytics}/analytics/advocate-summary`, { cache: 'no-store' }),
    fetch(`${API_BASE.analytics}/analytics/commission-trends`, { cache: 'no-store' }),
    fetch(`${API_BASE.analytics}/analytics/income-by-zone-category`, { cache: 'no-store' }),
    fetch(`${API_BASE.analytics}/analytics/top-complaints`, { cache: 'no-store' }),
    fetch(`${API_BASE.analytics}/analytics/vulnerability-flags`, { cache: 'no-store' }),
    fetch(`${API_BASE.grievance}/api/complaints/board/tag-clusters`, { cache: 'no-store' }),
    authFetch(
      `${API_BASE.grievance}/api/complaints/advocate/new-count?${new URLSearchParams({ since })}`,
    ),
  ]);

  const summary = await safeJson<AdvocateSummary>(summaryRes);
  if (!summary) errors.push('Could not load advocate summary (analytics).');

  const commission = (await safeJson<CommissionTrendRow[]>(commissionRes)) ?? [];
  if (!commissionRes.ok) errors.push('Commission trends unavailable.');

  const incomeByZoneCategory = (await safeJson<IncomeZoneCategoryRow[]>(incomeZCRes)) ?? [];
  if (!incomeZCRes.ok) errors.push('Income by zone/category unavailable.');

  const topComplaints = (await safeJson<TopComplaintRow[]>(topRes)) ?? [];
  if (!topRes.ok) errors.push('Top complaints unavailable.');

  const vulnerability = (await safeJson<VulnerabilityRow[]>(vulnRes)) ?? [];
  if (!vulnRes.ok) errors.push('Vulnerability flags unavailable.');

  let tagClusters: TagClusterRow[] = [];
  if (clustersRes.ok) {
    tagClusters = ((await clustersRes.json()) as TagClusterRow[]) ?? [];
  } else {
    errors.push('Grievance clusters unavailable.');
  }

  let grievanceInboxDelta = 0;
  if (inboxRes.ok) {
    const j = (await inboxRes.json()) as { count?: number };
    grievanceInboxDelta = j.count ?? 0;
  }

  return {
    summary,
    commission,
    incomeByZoneCategory,
    topComplaints,
    vulnerability,
    tagClusters,
    grievanceInboxDelta,
    errors,
  };
}
