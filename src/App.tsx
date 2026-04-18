/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
interface Shift {
  id: string;
  platform: 'Careem' | 'Bykea' | 'foodpanda' | 'Upwork';
  shift_date: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  verification_status: 'pending' | 'verified' | 'flagged';
}

interface UserProfile {
  name: string;
  id: string;
  role: 'worker' | 'verifier' | 'advocate';
  city_zone: string;
  category: string;
}

// --- Mock Data ---
const MOCK_USER: UserProfile = {
  name: "Muhammad Ali",
  id: "GW-2025-00432",
  role: 'worker',
  city_zone: "DHA Lahore",
  category: "Ride-Hailing"
};

const MOCK_SHIFTS: Shift[] = [
  { id: '1', platform: 'Careem', shift_date: '2025-01-28', hours_worked: 6, gross_earned: 2100, platform_deductions: 420, net_received: 1680, verification_status: 'verified' },
  { id: '2', platform: 'Bykea', shift_date: '2025-01-27', hours_worked: 4, gross_earned: 1450, platform_deductions: 280, net_received: 1170, verification_status: 'verified' },
  { id: '3', platform: 'Careem', shift_date: '2025-01-27', hours_worked: 8, gross_earned: 3200, platform_deductions: 1120, net_received: 2080, verification_status: 'verified' },
  { id: '4', platform: 'foodpanda', shift_date: '2025-01-26', hours_worked: 5, gross_earned: 1800, platform_deductions: 630, net_received: 1170, verification_status: 'pending' },
];

const EARNINGS_TREND = [
  { name: 'Jan 22', value: 2400 },
  { name: 'Jan 23', value: 3600 },
  { name: 'Jan 24', value: 2700 },
  { name: 'Jan 25', value: 4200 },
  { name: 'Jan 26', value: 5100 },
  { name: 'Jan 27', value: 3900 },
  { name: 'Jan 28', value: 3100 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'shifts' | 'grievances' | 'certificate' | 'analytics'>('dashboard');
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
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
        body: JSON.stringify({ worker_id: userId, earnings: sData.slice(0, 10) })
      });
      const aData = await aRes.json();
      setAnomaly(aData);

      // Fetch User Info
      const uRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (uRes.ok) {
        const uData = await uRes.json();
        setUser(uData);
      } else {
        // Fallback for demo
        setUser({ ...MOCK_USER, id: userId || 'worker-1' });
      }

      // Fetch Median
      const mRes = await fetch(`/api/analytics/median/ride_hailing/DHA`);
      const mData = await mRes.json();
      setMedian(mData.median_hourly);

      // Fetch Income Distribution (for all zones)
      const distRes = await fetch('/api/analytics/income-distribution');
      const distData = await distRes.json();
      setDistributionData(distData);

      // Fetch Commission Trends
      const trendsRes = await fetch('/api/analytics/commission-trends');
      setTrendsData(await trendsRes.json());

      // Fetch Vulnerability Flags
      const vulnRes = await fetch('/api/analytics/vulnerability-flags');
      setVulnerabilityData(await vulnRes.json());

      // Fetch Top Complaints
      const compRes = await fetch('/api/analytics/top-complaints');
      setTopComplaintsData(await compRes.json());

    } catch (e) {
      console.error('Data fetch failed', e);
    } finally {
      setLoading(false);
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
                <div className="flex justify-between mt-3">
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase font-bold text-brand">Your Rate</span>
                    <span className="text-xs font-black">{Math.round(avgHourlyRate)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] uppercase font-bold text-text-muted">Median</span>
                    <span className="text-xs font-black">{median}</span>
                  </div>
                </div>
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

              <div className="p-12 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Worker Profile</label>
                    <div className="text-lg font-black mt-1">{user?.name}</div>
                    <div className="text-xs text-text-muted font-medium mt-0.5">ID: {user?.id}</div>
                  </div>
                  <div className="text-right">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Region / Category</label>
                    <div className="text-lg font-black mt-1">{user?.city_zone}</div>
                    <div className="text-xs text-text-muted font-medium mt-0.5">{user?.category}</div>
                  </div>
                </div>

                <div className="border-y border-border-dim py-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-[10px] font-bold text-text-muted uppercase mb-1">Total Net</div>
                      <div className="text-xl font-black">Rs. {totalVerifiedNet.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-text-muted uppercase mb-1">Avg Hourly</div>
                      <div className="text-xl font-black">Rs. {Math.round(avgHourlyRate)}/hr</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-text-muted uppercase mb-1">Status</div>
                      <div className="text-xl font-black text-brand">VERIFIED</div>
                    </div>
                  </div>
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 border-t border-border-dim text-center">
        <p className="text-[10px] text-text-muted font-bold tracking-widest uppercase">
          FairGig © 2026 • Built for SOFTEC Web Dev Competition
        </p>
      </footer>
    </div>
  );
}
