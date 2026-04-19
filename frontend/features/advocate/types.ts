export type AdvocateSummary = {
  total_workers: number;
  new_workers_this_month: number;
  new_workers_last_month: number;
  registration_mom_pct: number;
  avg_commission_rate: number;
  avg_commission_rate_prev_month_pct: number;
  commission_mom_delta_pp: number;
  active_complaints: number;
  escalated_complaints: number;
  vulnerability_count: number;
};

export type CommissionTrendRow = {
  month: string;
  platform: string;
  avg_rate: number;
};

export type IncomeZoneCategoryRow = {
  zone: string;
  category: string;
  total_net: string | number;
};

export type TopComplaintRow = {
  category: string;
  count: number;
};

export type VulnerabilityRow = {
  id: string;
  name: string;
  city_zone: string;
  category: string;
  current_month: number;
  previous_month: number;
  drop_percentage: number;
};

export type TagClusterRow = {
  primary_tag: string;
  platform: string;
  complaint_count: number;
  complaint_ids?: string[];
};

export type AdvocateDashboardPayload = {
  summary: AdvocateSummary | null;
  commission: CommissionTrendRow[];
  incomeByZoneCategory: IncomeZoneCategoryRow[];
  topComplaints: TopComplaintRow[];
  vulnerability: VulnerabilityRow[];
  tagClusters: TagClusterRow[];
  grievanceInboxDelta: number;
  errors: string[];
};
