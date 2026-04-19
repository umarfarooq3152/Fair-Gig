export const API_BASE = {
  auth: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || '/api/authsvc',
  earnings: process.env.NEXT_PUBLIC_EARNINGS_SERVICE_URL || '/api/earningssvc',
  anomaly: process.env.NEXT_PUBLIC_ANOMALY_SERVICE_URL || '/api/anomalysvc',
  grievance: process.env.NEXT_PUBLIC_GRIEVANCE_SERVICE_URL || '/api/grievancesvc',
  analytics: process.env.NEXT_PUBLIC_ANALYTICS_SERVICE_URL || '/api/analyticssvc',
};

export function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('fairgig_access_token') || localStorage.getItem('fairgig_token') || '';
}

export async function authFetch(url: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers, cache: 'no-store' });
}
