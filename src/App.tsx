import { FormEvent, useMemo, useState } from 'react';

type UserRole = 'worker' | 'verifier' | 'advocate';

type AuthUser = {
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

const roles: UserRole[] = ['worker', 'verifier', 'advocate'];
const zones = ['Gulberg', 'DHA', 'Saddar', 'Johar Town', 'Cantt', 'Other'];
const categories = ['ride_hailing', 'food_delivery', 'freelance', 'domestic'];
const platforms = ['Careem', 'Bykea', 'foodpanda', 'Upwork', 'Other'];

const env = (import.meta as any).env || {};
const authBases = env.VITE_AUTH_BASE_URL ? [env.VITE_AUTH_BASE_URL] : ['/api/auth', 'http://localhost:8001/auth'];
const earningsBases = env.VITE_EARNINGS_BASE_URL ? [env.VITE_EARNINGS_BASE_URL] : ['/api/shifts', 'http://localhost:8002/shifts'];
const verifierBases = env.VITE_VERIFIER_BASE_URL ? [env.VITE_VERIFIER_BASE_URL] : ['/api/verifier', 'http://localhost:8002/verifier'];

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

export default function App() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [token, setToken] = useState(localStorage.getItem('fairgig_token'));
  const [userId, setUserId] = useState(localStorage.getItem('fairgig_user_id'));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [verifierQueue, setVerifierQueue] = useState<VerifierQueueItem[]>([]);
  const [myReviewedShifts, setMyReviewedShifts] = useState<Shift[]>([]);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [decisionLoadingId, setDecisionLoadingId] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const [decisionSuccess, setDecisionSuccess] = useState('');
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsError, setEarningsError] = useState('');
  const [earningsSuccess, setEarningsSuccess] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    name: '',
    email: '',
    password: '',
    role: 'worker',
    city_zone: 'DHA',
    category: 'ride_hailing',
    phone: '',
  });

  const [shiftForm, setShiftForm] = useState<ShiftForm>({
    platform: 'Careem',
    shift_date: new Date().toISOString().slice(0, 10),
    hours_worked: '8',
    gross_earned: '2400',
    platform_deductions: '600',
    notes: '',
  });

  const netPreview = useMemo(() => {
    const gross = Number(shiftForm.gross_earned);
    const deductions = Number(shiftForm.platform_deductions);
    if (Number.isNaN(gross) || Number.isNaN(deductions)) {
      return 0;
    }
    return Math.max(0, gross - deductions);
  }, [shiftForm.gross_earned, shiftForm.platform_deductions]);

  const pendingByWorker = useMemo(() => {
    const grouped: Record<string, VerifierQueueItem[]> = {};
    for (const item of verifierQueue) {
      const key = `${item.worker_name} (${item.worker_id.slice(0, 8)})`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }
    return grouped;
  }, [verifierQueue]);

  const myReviewedByWorker = useMemo(() => {
    const grouped: Record<string, Shift[]> = {};
    for (const item of myReviewedShifts) {
      const name = item.worker_name || 'Unknown Worker';
      const idPart = item.worker_id ? item.worker_id.slice(0, 8) : 'unknown';
      const key = `${name} (${idPart})`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }
    return grouped;
  }, [myReviewedShifts]);

  async function fetchProfile(authToken: string, currentUserId: string) {
    try {
      const { response: meRes, payload: mePayload } = await fetchWithFallback(authBases, '/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (meRes.ok) {
        setUser(mePayload);

        if (mePayload.role === 'verifier') {
          const { response: shiftsRes, payload: shiftsPayload } = await fetchWithFallback(earningsBases, '');
          if (shiftsRes.ok && Array.isArray(shiftsPayload)) {
            const pending = shiftsPayload
              .filter((s: Shift) => s.verification_status === 'pending')
              .map((s: Shift): VerifierQueueItem => ({
                shift_id: s.id,
                worker_id: s.worker_id || 'unknown',
                worker_name: s.worker_name || 'Unknown Worker',
                city_zone: null,
                category: null,
                platform: s.platform,
                shift_date: s.shift_date,
                hours_worked: s.hours_worked,
                gross_earned: s.gross_earned,
                platform_deductions: s.platform_deductions,
                net_received: s.net_received,
                deduction_rate: Number(s.deduction_rate || 0),
                screenshot_url: s.screenshot_url || null,
                submitted_at: s.created_at || s.shift_date,
              }));

            const mine = shiftsPayload.filter(
              (s: Shift) => s.verifier_id === mePayload.id && s.verification_status !== 'pending',
            );
            setVerifierQueue(pending);
            setMyReviewedShifts(mine);
          } else {
            setVerifierQueue([]);
            setMyReviewedShifts([]);
          }
          setShifts([]);
          return;
        }

        setVerifierQueue([]);
        setMyReviewedShifts([]);
      } else {
        setUser(null);
      }

      const { response: shiftsRes, payload: shiftsPayload } = await fetchWithFallback(
        earningsBases,
        `?worker_id=${encodeURIComponent(currentUserId)}`,
      );
      if (shiftsRes.ok) {
        setShifts(shiftsPayload);
      } else {
        setShifts([]);
      }
    } catch {
      setUser(null);
      setShifts([]);
      setVerifierQueue([]);
      setMyReviewedShifts([]);
    }
  }

  async function handleVerifierDecision(shiftId: string, status: 'verified' | 'flagged' | 'unverifiable') {
    if (!user?.id) {
      setDecisionError('Verifier user id not available');
      return;
    }

    setDecisionLoadingId(shiftId);
    setDecisionError('');
    setDecisionSuccess('');

    try {
      const { response, payload } = await fetchWithFallback(verifierBases, `/${shiftId}/decision`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          verifier_id: user.id,
          verifier_note: decisionNotes[shiftId] || '',
        }),
      });

      if (!response.ok) {
        setDecisionError(getErrorMessage(payload, 'Could not update verification decision'));
        return;
      }

      setDecisionSuccess(`Shift ${status} successfully`);
      if (token && userId) {
        await fetchProfile(token, userId);
      }
    } catch {
      setDecisionError('Unable to connect to verifier service');
    } finally {
      setDecisionLoadingId(null);
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const { response: res, payload } = await fetchWithFallback(authBases, '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      if (!res.ok) {
        setAuthError(getErrorMessage(payload, 'Login failed'));
        return;
      }

      localStorage.setItem('fairgig_token', payload.access_token);
      localStorage.setItem('fairgig_user_id', payload.user_id);
      setToken(payload.access_token);
      setUserId(payload.user_id);
      await fetchProfile(payload.access_token, payload.user_id);
    } catch {
      setAuthError('Unable to connect to auth service');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const registerPayload: Record<string, string> = {
        name: registerForm.name,
        email: registerForm.email,
        password: registerForm.password,
        role: registerForm.role,
      };

      if (registerForm.role === 'worker') {
        registerPayload.city_zone = registerForm.city_zone;
        registerPayload.category = registerForm.category;
        registerPayload.phone = registerForm.phone;
      }

      const { response: registerRes, payload: registerData } = await fetchWithFallback(authBases, '/register', {
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

      setEarningsSuccess('Earning added successfully');
      setShifts((prev) => [data, ...prev]);
      setShiftForm((prev) => ({ ...prev, notes: '' }));
    } catch {
      setEarningsError('Unable to connect to earnings service');
    } finally {
      setEarningsLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('fairgig_token');
    localStorage.removeItem('fairgig_user_id');
    setToken(null);
    setUserId(null);
    setUser(null);
    setShifts([]);
    setVerifierQueue([]);
    setMyReviewedShifts([]);
    setDecisionNotes({});
    setDecisionError('');
    setDecisionSuccess('');
    setAuthError('');
    setEarningsError('');
    setEarningsSuccess('');
  }

  if (token && userId && !user) {
    void fetchProfile(token, userId);
  }

  if (!token || !userId) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-emerald-100 via-white to-cyan-100 px-4 py-10">
        <div className="mx-auto max-w-5xl rounded-3xl border border-emerald-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-10">
          <div className="grid gap-8 md:grid-cols-2">
            <section>
              <p className="mb-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">FairGig Startup</p>
              <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">Login or Sign Up to Continue</h1>
              <p className="mt-3 text-sm text-slate-600">
                Choose your role while signing up, and start tracking verified gig earnings from day one.
              </p>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Duplicate email protection is enabled. You cannot create two accounts with the same email.
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  className={`w-1/2 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'}`}
                  onClick={() => {
                    setMode('login');
                    setAuthError('');
                  }}
                  type="button"
                >
                  Login
                </button>
                <button
                  className={`w-1/2 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'signup' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'}`}
                  onClick={() => {
                    setMode('signup');
                    setAuthError('');
                  }}
                  type="button"
                >
                  Sign Up
                </button>
              </div>

              {mode === 'login' ? (
                <form className="space-y-3" onSubmit={handleLogin}>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Email"
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Password"
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                  <button
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    type="submit"
                    disabled={authLoading}
                  >
                    {authLoading ? 'Logging in...' : 'Login'}
                  </button>
                </form>
              ) : (
                <form className="space-y-3" onSubmit={handleSignup}>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Full Name"
                    required
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Email"
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Password"
                    type="password"
                    minLength={6}
                    required
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={registerForm.role}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>

                  {registerForm.role === 'worker' && (
                    <>
                      <select
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        value={registerForm.city_zone}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, city_zone: e.target.value }))}
                      >
                        {zones.map((zone) => (
                          <option key={zone} value={zone}>
                            {zone}
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        value={registerForm.category}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, category: e.target.value }))}
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Phone Number (optional)"
                        value={registerForm.phone}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </>
                  )}

                  <button
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    type="submit"
                    disabled={authLoading}
                  >
                    {authLoading ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>
              )}

              {authError && <p className="mt-3 text-sm font-medium text-red-600">{authError}</p>}
            </section>
          </div>
        </div>
      </main>
    );
  }

  const visibleShifts = shifts.slice(0, 8);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Earnings Service</h1>
            <p className="text-sm text-slate-600">
              Logged in as <span className="font-semibold">{user?.name || 'User'}</span> ({user?.role || 'unknown'})
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:mt-0"
          >
            Logout
          </button>
        </header>

        {user?.role === 'worker' ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={handleAddEarning} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Add New Earning</h2>

              <label className="block text-sm font-medium text-slate-700">Platform</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={shiftForm.platform}
                onChange={(e) => setShiftForm((prev) => ({ ...prev, platform: e.target.value }))}
              >
                {platforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium text-slate-700">Shift Date</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                type="date"
                required
                value={shiftForm.shift_date}
                onChange={(e) => setShiftForm((prev) => ({ ...prev, shift_date: e.target.value }))}
              />

              <label className="block text-sm font-medium text-slate-700">Hours Worked</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                type="number"
                step="0.1"
                min="0.1"
                required
                value={shiftForm.hours_worked}
                onChange={(e) => setShiftForm((prev) => ({ ...prev, hours_worked: e.target.value }))}
              />

              <label className="block text-sm font-medium text-slate-700">Gross Earned (PKR)</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                type="number"
                step="0.01"
                min="0"
                required
                value={shiftForm.gross_earned}
                onChange={(e) => setShiftForm((prev) => ({ ...prev, gross_earned: e.target.value }))}
              />

              <label className="block text-sm font-medium text-slate-700">Platform Deductions (PKR)</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                type="number"
                step="0.01"
                min="0"
                required
                value={shiftForm.platform_deductions}
                onChange={(e) => setShiftForm((prev) => ({ ...prev, platform_deductions: e.target.value }))}
              />

              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                Net Received (auto): PKR {netPreview.toFixed(2)}
              </div>

              <label className="block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={shiftForm.notes}
                onChange={(e) => setShiftForm((prev) => ({ ...prev, notes: e.target.value }))}
              />

              <button
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                type="submit"
                disabled={earningsLoading}
              >
                {earningsLoading ? 'Saving...' : 'Add Earning'}
              </button>

              {earningsError && <p className="text-sm font-medium text-red-600">{earningsError}</p>}
              {earningsSuccess && <p className="text-sm font-medium text-emerald-700">{earningsSuccess}</p>}
            </form>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-slate-900">Recent Earnings</h2>
              {visibleShifts.length === 0 ? (
                <p className="text-sm text-slate-600">No shifts found yet. Add your first earning entry.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Platform</th>
                        <th className="px-2 py-2">Hours</th>
                        <th className="px-2 py-2">Net</th>
                        <th className="px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleShifts.map((shift) => (
                        <tr key={shift.id}>
                          <td className="px-2 py-2">{shift.shift_date}</td>
                          <td className="px-2 py-2">{shift.platform}</td>
                          <td className="px-2 py-2">{shift.hours_worked}</td>
                          <td className="px-2 py-2">PKR {Number(shift.net_received).toFixed(2)}</td>
                          <td className="px-2 py-2 capitalize">{shift.verification_status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </section>
        ) : user?.role === 'verifier' ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Pending Worker Entries</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  {verifierQueue.length} pending
                </span>
              </div>

              {Object.keys(pendingByWorker).length === 0 ? (
                <p className="text-sm text-slate-600">No pending entries requiring verification right now.</p>
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

                            {entry.screenshot_url && (
                              <a
                                href={entry.screenshot_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-block text-xs font-semibold text-emerald-700 underline"
                              >
                                View Screenshot
                              </a>
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
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">My Reviewed Entries</h2>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {myReviewedShifts.length} total
                </span>
              </div>

              {Object.keys(myReviewedByWorker).length === 0 ? (
                <p className="text-sm text-slate-600">No entries reviewed by you yet.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(myReviewedByWorker).map(([workerLabel, entries]) => (
                    <div key={workerLabel} className="rounded-xl border border-slate-200 p-3">
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">{workerLabel}</h3>
                      <ul className="space-y-2 text-xs text-slate-700">
                        {entries.slice(0, 12).map((entry) => (
                          <li key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>
                                {entry.shift_date} • {entry.platform} • Net PKR {Number(entry.net_received).toFixed(2)}
                              </span>
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold capitalize">
                                {entry.verification_status}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {decisionError && <p className="mt-3 text-sm font-medium text-red-600">{decisionError}</p>}
              {decisionSuccess && <p className="mt-3 text-sm font-medium text-emerald-700">{decisionSuccess}</p>}
            </section>
          </section>
        ) : (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            Earnings entry is available for worker accounts. You are logged in as {user?.role}.
          </section>
        )}
      </div>
    </main>
  );
}