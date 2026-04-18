/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, Cell
} from 'recharts';
import {
  LayoutDashboard,
  History,
  AlertTriangle,
  FileText,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Plus,
  ArrowUpRight,
  TrendingDown,
  User,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
// (Type definitions follow...)
  id: string;
  name: string;
  email: string;
  role: UserRole;
  city_zone?: string | null;
  category?: string | null;
};

type Shift = {
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

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  city_zone: string;
  category: string;
  phone: string;
};

type ShiftForm = {
  platform: string;
  shift_date: string;
  hours_worked: string;
  gross_earned: string;
  platform_deductions: string;
  notes: string;
};

type CsvDraftRow = {
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

type VerifierQueueItem = {
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

type ComplaintItem = {
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

type AppSection = 'earnings' | 'community' | 'advocate' | 'verifier';

const roles: UserRole[] = ['worker', 'verifier', 'advocate'];
const zones = ['Gulberg', 'DHA', 'Saddar', 'Johar Town', 'Cantt', 'Other'];
const categories = ['ride_hailing', 'food_delivery', 'freelance', 'domestic'];
const platforms = ['Careem', 'Bykea', 'foodpanda', 'Upwork', 'Other'];
const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxScreenshotBytes = 10 * 1024 * 1024;
const maxCsvBytes = 5 * 1024 * 1024;
const csvRequiredColumns = [
  'platform',
  'shift_date',
  'hours_worked',
  'gross_earned',
  'platform_deductions',
  'net_received',
  'notes',
];

const env = (import.meta as any).env || {};
const authBases = env.VITE_AUTH_BASE_URL ? [env.VITE_AUTH_BASE_URL] : ['/api/auth', 'http://localhost:8001/auth'];
const earningsBases = env.VITE_EARNINGS_BASE_URL ? [env.VITE_EARNINGS_BASE_URL] : ['/api/shifts', 'http://localhost:8002/shifts'];
const verifierBases = env.VITE_VERIFIER_BASE_URL ? [env.VITE_VERIFIER_BASE_URL] : ['/api/verifier', 'http://localhost:8002/verifier'];
const grievanceBases = env.VITE_GRIEVANCE_BASE_URL ? [env.VITE_GRIEVANCE_BASE_URL] : ['http://localhost:8004/api', '/api'];

function joinBase(base: string, endpoint: string) {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

async function fetchWithFallback(
  bases: string[],
  endpoint: string,
  options?: RequestInit,
): Promise<{ response: Response; payload: any }> {
  let lastError: unknown;

  for (const base of bases) {
    try {
      const response = await fetch(joinBase(base, endpoint), options);
      const payload = await parseJsonSafe(response);

      // If mounted proxy path is wrong in current runtime, try direct service URL fallback.
      if (response.status === 404 && bases.length > 1) {
        continue;
      }

      return { response, payload };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

function getErrorMessage(payload: any, fallback: string) {
  return payload?.detail || payload?.message || fallback;
}

function getUnknownErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function isCsvRowReady(row: CsvDraftRow) {
  return row.errors.length === 0 && !!row.screenshotFile;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells.map((c) => c.replace(/^"|"$/g, '').trim());
}

function normalizeCsvDate(input: string) {
  const value = (input || '').trim();
  if (!value) {
    return { value: '', error: 'shift_date is required' };
  }

  // Already in ISO format.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { value };
  }

  const compact = value.replace(/\./g, '/').replace(/-/g, '/');
  const parts = compact.split('/').map((p) => p.trim());

  if (parts.length === 3) {
    // YYYY/MM/DD
    if (/^\d{4}$/.test(parts[0])) {
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      const d = Number(parts[2]);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return {
          value: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        };
      }
    }

    // DD/MM/YYYY or MM/DD/YYYY heuristics.
    if (/^\d{4}$/.test(parts[2])) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      const y = Number(parts[2]);

      let d = a;
      let m = b;

      // If first token cannot be month, assume DD/MM.
      if (a > 12 && b <= 12) {
        d = a;
        m = b;
      } else if (b > 12 && a <= 12) {
        // If second token cannot be month, assume MM/DD.
        m = a;
        d = b;
      } else {
        // Ambiguous: default to DD/MM.
        d = a;
        m = b;
      }

      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return {
          value: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        };
      }
    }
  }

  return { value: '', error: `shift_date must be YYYY-MM-DD (received: ${value})` };
}

export default function App() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [token, setToken] = useState(localStorage.getItem('fairgig_token'));
  const [userId, setUserId] = useState(localStorage.getItem('fairgig_user_id'));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('fairgig_token'));
  const [anomaly, setAnomaly] = useState<any>(null);
  const [median, setMedian] = useState<number>(260);
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [vulnerabilityData, setVulnerabilityData] = useState<any[]>([]);
  const [topComplaintsData, setTopComplaintsData] = useState<any[]>([]);

  // Auto-login for demo if no token
  useEffect(() => {
    if (!token) {
      handleLogin('worker1@fairgig.demo', 'password123');
    } else {
      fetchInitialData();
    }
  }, [token]);

  const handleLogin = async (email: string, pass: string) => {
    try {
      const { response: res, payload } = await fetchWithFallback(authBases, '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem('fairgig_token', data.access_token);
        localStorage.setItem('fairgig_user_id', data.user_id);
        setToken(data.access_token);
      }
    } catch (e) {
      console.error('Login failed', e);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    const userId = localStorage.getItem('fairgig_user_id');
    try {
      // Fetch Shifts
      const sRes = await fetch(`/api/shifts?worker_id=${userId}`);
      const sData = await sRes.json();
      setShifts(sData);

      // Fetch Anomaly
      const aRes = await fetch('/api/anomaly/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerPayload),
      });

      if (!registerRes.ok) {
        setAuthError(getErrorMessage(registerData, 'Signup failed'));
        return;
      }

      const { response: loginRes, payload: loginData } = await fetchWithFallback(authBases, '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerForm.email,
          password: registerForm.password,
        }),
      });
      if (!loginRes.ok) {
        setAuthError(getErrorMessage(loginData, 'Signup complete but auto-login failed'));
        return;
      }

      localStorage.setItem('fairgig_token', loginData.access_token);
      localStorage.setItem('fairgig_user_id', loginData.user_id);
      setToken(loginData.access_token);
      setUserId(loginData.user_id);
      await fetchProfile(loginData.access_token, loginData.user_id);
    } catch {
      setAuthError('Unable to connect to auth service');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleAddEarning(e: FormEvent) {
    e.preventDefault();

    if (!userId) {
      setEarningsError('You must be logged in before adding earnings');
      return;
    }

    if (!screenshotFile) {
      setEarningsError('Screenshot is mandatory for submitting earnings');
      return;
    }

    if (!screenshotFile.type.startsWith('image/')) {
      setEarningsError('Screenshot must be an image file');
      return;
    }
    if (!supportedImageTypes.includes(screenshotFile.type)) {
      setEarningsError('Unsupported screenshot type. Allowed: JPG, PNG, WEBP');
      return;
    }
    if (screenshotFile.size > maxScreenshotBytes) {
      setEarningsError('Screenshot is too large. Max allowed size is 10MB');
      return;
    }

    const payload = {
      worker_id: userId,
      platform: shiftForm.platform,
      shift_date: shiftForm.shift_date,
      hours_worked: Number(shiftForm.hours_worked),
      gross_earned: Number(shiftForm.gross_earned),
      platform_deductions: Number(shiftForm.platform_deductions),
      net_received: Number((Number(shiftForm.gross_earned) - Number(shiftForm.platform_deductions)).toFixed(2)),
      notes: shiftForm.notes || null,
    };

    if (payload.gross_earned < 0 || payload.platform_deductions < 0 || payload.hours_worked <= 0) {
      setEarningsError('Hours must be > 0, and amounts cannot be negative');
      return;
    }

    setEarningsLoading(true);
    setEarningsError('');
    setEarningsSuccess('');
    let createdShiftId: string | null = null;

    const rollbackCreatedShift = async () => {
      if (!createdShiftId) return;
      try {
        await fetchWithFallback(earningsBases, `/${createdShiftId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worker_id: userId }),
        });
      } catch {
        // Ignore rollback failures and preserve the original UI error.
      }
    };

    try {
      const { response: res, payload: data } = await fetchWithFallback(earningsBases, '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setEarningsError(getErrorMessage(data, 'Could not add earning'));
        return;
      }

      createdShiftId = data.id;

      let screenshotRes: Response;
      let screenshotPayload: any;
      try {
        const formData = new FormData();
        formData.append('worker_id', userId);
        formData.append('file', screenshotFile);

        const screenshotCall = await fetchWithFallback(earningsBases, `/${data.id}/screenshot`, {
          method: 'POST',
          body: formData,
        });
        screenshotRes = screenshotCall.response;
        screenshotPayload = screenshotCall.payload;
      } catch (error) {
        await rollbackCreatedShift();
        setEarningsError(
          `Saved shift but could not reach screenshot endpoint on earnings service. ${getUnknownErrorMessage(error, 'Ensure earnings service is running on port 8002.')}`,
        );
        return;
      }

      if (!screenshotRes.ok) {
        await rollbackCreatedShift();
        setEarningsError(getErrorMessage(screenshotPayload, 'Shift saved, but could not save screenshot URL'));
        return;
      }

      setEarningsSuccess('Earning added successfully');
      setShifts((prev) => [
        {
          ...data,
          screenshot_url: screenshotPayload?.file_url || null,
          has_screenshot: true,
        },
        ...prev,
      ]);
      setShiftForm((prev) => ({ ...prev, notes: '' }));
      setScreenshotFile(null);
    } catch (error) {
      await rollbackCreatedShift();
      setEarningsError(
        `Unable to save earning entry. ${getUnknownErrorMessage(error, 'Ensure earnings service is available on port 8002.')}`,
      );
    } finally {
      setEarningsLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen font-black text-brand animate-pulse">FAIRGIG INITIALIZING...</div>;

  // Stats calculation
  const totalVerifiedNet = shifts.filter(s => s.verification_status === 'verified').reduce((acc, curr) => acc + curr.net_received, 0);
  const totalHours = shifts.filter(s => s.verification_status === 'verified').reduce((acc, curr) => acc + curr.hours_worked, 0);
  const avgHourlyRate = totalHours > 0 ? totalVerifiedNet / totalHours : 0;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-card border-b border-border-dim px-8 h-16 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="text-2xl font-black tracking-tighter text-brand flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6" />
            FairGig
          </div>
          <nav className="flex gap-6">
            {(user?.role === 'advocate' 
              ? ['dashboard', 'analytics', 'grievances'] 
              : ['dashboard', 'shifts', 'grievances', 'certificate']
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`text-sm font-semibold capitalize pt-1 pb-1 transition-all relative ${
                  activeTab === tab ? 'text-text-main' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="nav-underline" className="absolute bottom-[-1.5rem] left-0 right-0 h-0.5 bg-brand" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-bold text-text-main">{MOCK_USER.name}</div>
            <div className="text-[10px] text-text-muted tracking-wide">ID: {MOCK_USER.id}</div>
          </div>
          <div className="w-9 h-9 bg-gray-100 border border-border-dim rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-text-muted" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-5"
            >
              {/* Hero Chart Card */}
              <div className="card-bento md:col-span-2 md:row-span-2">
                <div className="flex justify-between mb-4">
                  <div className="card-title-bento">Earnings Overview (30D)</div>
                  <div className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full">+12.5%</div>
                </div>
                <div className="big-value">Rs. 85,400</div>
                <div className="text-xs text-text-muted mb-4 font-medium flex items-center gap-1">
                  Total verified earnings across platforms
                </div>
                <div className="flex-1 min-h-[240px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={EARNINGS_TREND}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" hide />
                      <YAxis hide domain={['dataMin - 500', 'dataMax + 500']} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          borderRadius: '12px', 
                          border: '1px solid #E5E7EB',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Stat Card 1 */}
              <div className="card-bento bg-white">
                <div className="card-title-bento">Verification</div>
                <div className="mt-2">
                  <span className="badge-bento">94% Success</span>
                </div>
                <div className="big-value text-2xl mt-4">28 / 30</div>
                <div className="text-xs text-text-muted font-medium">Shifts verified this month</div>
              </div>

              {/* Anomaly Card */}
              <div className={`card-bento ${anomaly?.anomalies?.length > 0 ? 'bg-red-50 border-red-100' : 'bg-white'}`}>
                {anomaly?.anomalies?.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-danger" />
                      <div className="text-xs font-bold text-danger uppercase tracking-wider">Anomaly Flagged</div>
                    </div>
                    <div className="text-[13px] font-bold text-text-main mb-1">{anomaly.anomalies[0].type.replace('_', ' ')}</div>
                    <p className="text-[11px] leading-relaxed text-text-main opacity-80">
                      {anomaly.anomalies[0].explanation}. Our service suggests a dispute.
                    </p>
                    <div className="mt-auto">
                      <button className="text-[10px] font-bold text-danger underline underline-offset-2">View Analysis</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-brand" />
                      <div className="text-xs font-bold text-brand uppercase tracking-wider">System Healthy</div>
                    </div>
                    <div className="text-[13px] font-bold text-text-main mb-1">No Anomalies</div>
                    <p className="text-[11px] leading-relaxed text-text-muted">
                      Your deduction rates are within platform norms for your zone.
                    </p>
                  </>
                )}
              </div>

              {/* Stat Card 2 */}
              <div className="card-bento bg-white">
                <div className="card-title-bento">Hourly Rate</div>
                <div className="big-value text-2xl">Rs. 274/hr</div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-xs font-bold text-brand">Superior</span>
                  <span className="text-[10px] text-text-muted">Avg: Rs. 260</span>
                </div>
              </div>

              {/* Median Card */}
              <div className="card-bento bg-white">
                <div className="card-title-bento">City Comparison</div>
                <div className="text-[11px] font-bold mb-3">{MOCK_USER.city_zone} Median</div>
                <div className="w-full h-2 bg-gray-100 rounded-full relative overflow-visible">
                  <div className="absolute top-0 left-0 h-full bg-brand rounded-full" 
                       style={{ width: `${Math.min(100, (avgHourlyRate / (median * 1.5)) * 100)}%` }} />
                  <div className="absolute top-[-4px] left-[66%] h-4 w-0.5 bg-black" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    onClick={() => {
                      setCommunityError('');
                      setCommunitySuccess('');
                      setShowCreateComplaintModal(true);
                    }}
                  >
                    + New Complaint
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setShowMyComplaintsModal(true)}
                  >
                    My Previous Complaints
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={communityFilterPlatform}
                  onChange={(e) => setCommunityFilterPlatform(e.target.value)}
                >
                  <option value="all">All Platforms</option>
                  {platforms.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={communityFilterCategory}
                  onChange={(e) => setCommunityFilterCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="commission_hike">commission_hike</option>
                  <option value="account_deactivation">account_deactivation</option>
                  <option value="payment_delay">payment_delay</option>
                  <option value="unfair_rating">unfair_rating</option>
                  <option value="data_privacy">data_privacy</option>
                  <option value="other">other</option>
                </select>
              </div>

              {/* Recent Activity Card */}
              <div className="card-bento md:col-span-2">
                <div className="card-title-bento">Recent Verified Shifts</div>
                <div className="space-y-1">
                  {shifts.slice(0, 3).map((shift) => (
                    <div key={shift.id} className="flex items-center justify-between py-2 border-b border-border-dim last:border-0 hover:bg-gray-50/50 px-2 rounded-lg transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          shift.platform === 'Careem' ? 'bg-green-100 text-green-700' : 
                          shift.platform === 'Bykea' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'
                        }`}>
                          {shift.platform}
                        </div>
                        <div className="text-xs font-semibold text-text-main">{shift.shift_date}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xs font-black">Rs. {shift.net_received}</div>
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                        <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Card */}
              <div className="card-bento md:col-span-2 flex-row items-center gap-6 overflow-hidden">
                <div className="flex-1">
                  <div className="card-title-bento">Quick Actions</div>
                  <p className="text-[11px] text-text-muted mt-1">Manage your earnings documentation and support requests.</p>
                </div>
                <div className="flex gap-3">
                  <button className="btn-bento btn-bento-outline flex gap-2">
                    <FileText className="w-4 h-4" />
                    Certificate
                  </button>
                  <button className="btn-bento btn-bento-primary flex gap-2">
                    <Plus className="w-4 h-4" />
                    New Shift
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'shifts' && (
            <motion.div
              key="shifts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">My Shifts</h2>
                <button className="btn-bento btn-bento-primary flex gap-2">
                  <Plus className="w-4 h-4" />
                  Log Shift
                </button>
              </div>
              <div className="card-bento p-0 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-border-dim">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Platform</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Date</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Hours</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Gross (Rs)</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Net (Rs)</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-dim">
                    {shifts.map((shift) => (
                      <tr key={shift.id} className="hover:bg-gray-50 transition-colors cursor-pointer group">
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-text-main">{shift.platform}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-text-muted">{shift.shift_date}</td>
                        <td className="px-6 py-4 text-xs font-medium">{shift.hours_worked}h</td>
                        <td className="px-6 py-4 text-xs font-bold text-text-muted">Rs. {shift.gross_earned}</td>
                        <td className="px-6 py-4 text-xs font-black">Rs. {shift.net_received}</td>
                        <td className="px-6 py-4">
                          <span className={`badge-bento ${
                            shift.verification_status === 'verified' ? 'bg-brand/10 text-brand' : 
                            shift.verification_status === 'pending' ? 'bg-yellow-50 text-warning' : 'bg-red-50 text-danger'
                          }`}>
                            {shift.verification_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'grievances' && (
            <motion.div
              key="grievances"
              className="flex items-center justify-center p-20"
            >
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Grievance Board</h2>
                <p className="text-sm text-text-muted max-w-xs mx-auto">
                  Report platform irregularities or deduction discrepancies. Our advocates review escalated cases.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'certificate' && (
            <motion.div
              key="certificate"
              className="card-bento max-w-2xl mx-auto shadow-2xl p-0 border-double border-4 border-gray-100"
            >
              <div className="bg-emerald-800 text-white p-12 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <LayoutDashboard className="w-32 h-32" />
                </div>
                <div className="flex flex-col items-center">
                  <CheckCircle2 className="w-16 h-16 mb-4 text-brand" />
                  <h1 className="text-3xl font-black uppercase tracking-widest mb-2">FairGig Certified</h1>
                  <p className="text-emerald-100 text-[10px] tracking-[0.2em] uppercase font-bold">Verified Income Statement</p>
                </div>
              </div>

              <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={verifierPlatformFilter}
                  onChange={(e) => setVerifierPlatformFilter(e.target.value)}
                >
                  <option value="all">All Platforms</option>
                  {pendingPlatformOptions.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>

                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Filter by worker name"
                  value={verifierWorkerFilter}
                  onChange={(e) => setVerifierWorkerFilter(e.target.value)}
                />

                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={verifierSortOrder}
                  onChange={(e) => setVerifierSortOrder(e.target.value as 'newest' | 'oldest')}
                >
                  <option value="oldest">Oldest First</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>

              {Object.keys(pendingByWorker).length === 0 ? (
                <p className="text-sm text-slate-600">No pending entries match the current filters.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(pendingByWorker).map(([workerLabel, entries]) => (
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
                                  onClick={() => setPreviewScreenshotUrl(entry.screenshot_url || null)}
                                >
                                  <img
                                    src={entry.screenshot_url}
                                    alt="Shift proof"
                                    className="h-20 w-32 object-cover"
                                  />
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

                            <textarea
                              className="mt-2 min-h-16 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                              placeholder="Add verifier note (optional)"
                              value={decisionNotes[entry.shift_id] || ''}
                              onChange={(e) =>
                                setDecisionNotes((prev) => ({
                                  ...prev,
                                  [entry.shift_id]: e.target.value,
                                }))
                              }
                            />

                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                disabled={decisionLoadingId === entry.shift_id}
                                onClick={() => handleVerifierDecision(entry.shift_id, 'verified')}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                disabled={decisionLoadingId === entry.shift_id}
                                onClick={() => handleVerifierDecision(entry.shift_id, 'flagged')}
                              >
                                Flag
                              </button>
                              <button
                                type="button"
                                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                disabled={decisionLoadingId === entry.shift_id}
                                onClick={() => handleVerifierDecision(entry.shift_id, 'unverifiable')}
                              >
                                Unverifiable
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-center">
                  <p className="text-[10px] text-text-muted italic mb-6">
                    This document certifies that the individual named above has successfully verified their platform earnings through FairGig protocols as of {new Date().toLocaleDateString()}.
                  </p>
                  <button 
                    onClick={() => window.print()}
                    className="btn-bento btn-bento-primary no-print"
                  >
                    Download Certificate (PDF)
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && user?.role === 'advocate' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">Advocate Analytics Panel</h2>
                <div className="text-xs font-bold text-text-muted uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full border border-border-dim">
                  Live Market View
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Income Distribution */}
                <div className="card-bento col-span-2">
                  <div className="card-title-bento mb-6">Income Distribution by Zone</div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={distributionData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="zone" tick={{ fontSize: 10, fontWeight: 700 }} interval={0} angle={-45} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10, fontWeight: 700 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB' }} />
                        <Bar dataKey="<20k" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="20k-40k" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="40k-60k" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="60k+" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Commission Trends */}
                <div className="card-bento md:col-span-1">
                  <div className="card-title-bento mb-4">Commission Trends (Last 6M)</div>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendsData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="month" hide />
                        <YAxis tick={{ fontSize: 8 }} domain={[0, 0.4]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="avg_rate" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-text-muted mt-2 uppercase font-bold text-center">Average multi-platform commission rate</p>
                </div>

                {/* Top Complaints */}
                <div className="card-bento md:col-span-1">
                   <div className="card-title-bento mb-4">Top Grievance Categories</div>
                   <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={topComplaintsData} margin={{ left: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="category" type="category" tick={{ fontSize: 9, fontWeight: 700 }} width={80} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Vulnerability Table */}
                <div className="card-bento col-span-2">
                  <div className="card-title-bento mb-4 text-danger flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Critical Vulnerability Flags (MoM Income Drop &gt; 20%)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border-dim text-[10px] font-black uppercase text-text-muted">
                          <th className="py-2">Worker Name</th>
                          <th className="py-2">Zone</th>
                          <th className="py-2 text-right">Prev Month</th>
                          <th className="py-2 text-right">Current Month</th>
                          <th className="py-2 text-center">Severity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-dim">
                        {vulnerabilityData.map(v => (
                          <tr key={v.id} className="text-xs">
                            <td className="py-3 font-bold">{v.name}</td>
                            <td className="py-3 text-text-muted">{v.city_zone}</td>
                            <td className="py-3 text-right">Rs. {v.previous_month}</td>
                            <td className="py-3 text-right text-danger font-black">Rs. {v.current_month}</td>
                            <td className="py-3 text-center">
                              <span className="badge-bento bg-red-100 text-red-600 border-red-200">High Risk</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <form onSubmit={submitCommunityComplaint} className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={communityForm.platform}
                    onChange={(e) => setCommunityForm((prev) => ({ ...prev, platform: e.target.value }))}
                  >
                    {platforms.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={communityForm.category}
                    onChange={(e) => setCommunityForm((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="commission_hike">commission_hike</option>
                    <option value="account_deactivation">account_deactivation</option>
                    <option value="payment_delay">payment_delay</option>
                    <option value="unfair_rating">unfair_rating</option>
                    <option value="data_privacy">data_privacy</option>
                    <option value="other">other</option>
                  </select>
                </div>

                <textarea
                  className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Describe complaint (minimum 20 chars)"
                  value={communityForm.description}
                  onChange={(e) => setCommunityForm((prev) => ({ ...prev, description: e.target.value }))}
                />

                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={communityForm.is_anonymous}
                    onChange={(e) => setCommunityForm((prev) => ({ ...prev, is_anonymous: e.target.checked }))}
                  />
                  Post anonymously
                </label>

                {communityError && <p className="text-sm font-medium text-red-600">{communityError}</p>}

                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="submit">
                  Post Complaint
                </button>
              </form>
            </div>
          </div>
        )}

        {showMyComplaintsModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowMyComplaintsModal(false)}
          >
            <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">My Previous Complaints</h3>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                  onClick={() => setShowMyComplaintsModal(false)}
                >
                  Close
                </button>
              </div>

              {myComplaintsError && <p className="mb-3 text-sm font-medium text-red-600">{myComplaintsError}</p>}

              {myComplaintsLoading ? (
                <p className="text-sm text-slate-600">Loading your complaints...</p>
              ) : myComplaints.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">You have not posted any complaints yet.</p>
              ) : (
                <div className="max-h-[65vh] space-y-3 overflow-auto pr-1">
                  {myComplaints.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{item.platform}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{item.category}</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold capitalize text-emerald-800">{item.status}</span>
                        <span>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Unknown date'}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-800">{item.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {previewScreenshotUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPreviewScreenshotUrl(null)}
          >
            <div className="max-h-[90vh] max-w-5xl overflow-hidden rounded-xl bg-white" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
                <p className="text-sm font-semibold text-slate-800">Screenshot Preview</p>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                  onClick={() => setPreviewScreenshotUrl(null)}
                >
                  Close
                </button>
              </div>
              <img src={previewScreenshotUrl} alt="Screenshot preview" className="max-h-[80vh] w-full object-contain" />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}