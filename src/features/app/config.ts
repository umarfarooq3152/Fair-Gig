import type { UserRole } from './types';

export const roles: UserRole[] = ['worker', 'verifier', 'advocate'];
export const zones = ['Gulberg', 'DHA', 'Saddar', 'Johar Town', 'Cantt', 'Other'];
export const categories = ['ride_hailing', 'food_delivery', 'freelance', 'domestic'];
export const platforms = ['Careem', 'Bykea', 'foodpanda', 'Upwork', 'Other'];
export const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const maxScreenshotBytes = 10 * 1024 * 1024;
export const maxCsvBytes = 5 * 1024 * 1024;
export const csvRequiredColumns = [
  'platform',
  'shift_date',
  'hours_worked',
  'gross_earned',
  'platform_deductions',
  'net_received',
  'notes',
];

const env = (import.meta as any).env || {};
/** Prefer direct service URLs so dev works without a same-origin `/api` proxy. Optional `/api` second for proxied setups. */
export const authBases = env.VITE_AUTH_BASE_URL
  ? [env.VITE_AUTH_BASE_URL]
  : ['http://localhost:8001/auth', '/api/auth'];
export const earningsBases = env.VITE_EARNINGS_BASE_URL
  ? [env.VITE_EARNINGS_BASE_URL]
  : ['http://localhost:8002/shifts', '/api/shifts'];
export const verifierBases = env.VITE_VERIFIER_BASE_URL
  ? [env.VITE_VERIFIER_BASE_URL]
  : ['http://localhost:8002/verifier', '/api/verifier'];
export const grievanceBases = env.VITE_GRIEVANCE_BASE_URL
  ? [env.VITE_GRIEVANCE_BASE_URL]
  : ['http://localhost:8004/api', '/api'];
export const anomalyBases = env.VITE_ANOMALY_BASE_URL
  ? [env.VITE_ANOMALY_BASE_URL]
  : ['http://localhost:8003'];
export const analyticsBases = env.VITE_ANALYTICS_BASE_URL
  ? [env.VITE_ANALYTICS_BASE_URL]
  : ['http://localhost:8005/analytics', '/api/analytics'];

export const clusterTagOptions = [
  'payment_delay',
  'commission_hike',
  'account_deactivation',
  'unfair_rating',
  'data_privacy',
  'other',
];
