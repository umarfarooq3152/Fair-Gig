export const API_BASE = {
  auth: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:8001',
  earnings: process.env.NEXT_PUBLIC_EARNINGS_SERVICE_URL || 'http://localhost:8002',
  anomaly: process.env.NEXT_PUBLIC_ANOMALY_SERVICE_URL || 'http://localhost:8003',
  grievance: process.env.NEXT_PUBLIC_GRIEVANCE_SERVICE_URL || 'http://localhost:8004',
  analytics: process.env.NEXT_PUBLIC_ANALYTICS_SERVICE_URL || 'http://localhost:8005',
};

export function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('fairgig_access_token') || '';
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
