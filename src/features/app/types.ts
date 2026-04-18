export type UserRole = 'worker' | 'verifier' | 'advocate';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  city_zone?: string | null;
  category?: string | null;
};

export type Shift = {
  id: string;
  worker_id?: string;
  worker_name?: string;
  verifier_id?: string | null;
  verifier_note?: string | null;
  screenshot_url?: string | null;
  deduction_rate?: number;
  created_at?: string;
  platform: string;
  shift_date: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  notes?: string | null;
  verification_status: string;
};

export type RegisterForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  city_zone: string;
  category: string;
  phone: string;
};

export type ShiftForm = {
  platform: string;
  shift_date: string;
  hours_worked: string;
  gross_earned: string;
  platform_deductions: string;
  notes: string;
};

export type CsvDraftRow = {
  rowNumber: number;
  platform: string;
  shift_date: string;
  hours_worked: string;
  gross_earned: string;
  platform_deductions: string;
  net_received: string;
  notes: string;
  errors: string[];
  uploaded: boolean;
  screenshotFile: File | null;
  screenshotFileName: string;
  uploadedShiftId?: string;
  uploadError?: string;
};

export type VerifierQueueItem = {
  shift_id: string;
  worker_id: string;
  worker_name: string;
  city_zone?: string | null;
  category?: string | null;
  platform: string;
  shift_date: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  deduction_rate: number;
  screenshot_url?: string | null;
  submitted_at: string;
};

export type ComplaintItem = {
  id: string;
  worker_id?: string;
  worker_name?: string;
  platform: string;
  category: string;
  description: string;
  is_anonymous?: boolean;
  tags?: string[];
  status: 'open' | 'escalated' | 'resolved' | 'rejected';
  cluster_id?: string | null;
  upvotes?: number;
  created_at?: string;
};

export type ComplaintCluster = {
  id: string;
  name: string;
  platform?: string | null;
  primary_tag?: string | null;
  complaint_count?: number;
};

export type ComplaintSpike = {
  platform: string;
  category: string;
  count: number;
  first_seen_at?: string;
  latest_seen_at?: string;
};

export type AppSection = 'dashboard' | 'earnings' | 'community' | 'advocate' | 'verifier';
