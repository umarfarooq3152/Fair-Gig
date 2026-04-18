import { FormEvent, useEffect, useMemo, useState } from 'react';

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
  const [verifierQueue, setVerifierQueue] = useState<VerifierQueueItem[]>([]);
  const [myReviewedShifts, setMyReviewedShifts] = useState<Shift[]>([]);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [decisionLoadingId, setDecisionLoadingId] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const [decisionSuccess, setDecisionSuccess] = useState('');
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsError, setEarningsError] = useState('');
  const [earningsSuccess, setEarningsSuccess] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [entryMode, setEntryMode] = useState<'manual' | 'csv'>('manual');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvRows, setCsvRows] = useState<CsvDraftRow[]>([]);
  const [csvError, setCsvError] = useState('');
  const [csvBusy, setCsvBusy] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ShiftForm | null>(null);
  const [previewScreenshotUrl, setPreviewScreenshotUrl] = useState<string | null>(null);
  const [verifierPlatformFilter, setVerifierPlatformFilter] = useState<string>('all');
  const [verifierWorkerFilter, setVerifierWorkerFilter] = useState('');
  const [verifierSortOrder, setVerifierSortOrder] = useState<'newest' | 'oldest'>('oldest');
  const [activeSection, setActiveSection] = useState<AppSection>('earnings');
  const [communityItems, setCommunityItems] = useState<ComplaintItem[]>([]);
  const [advocateItems, setAdvocateItems] = useState<ComplaintItem[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState('');
  const [communitySuccess, setCommunitySuccess] = useState('');
  const [communityFilterPlatform, setCommunityFilterPlatform] = useState('all');
  const [communityFilterCategory, setCommunityFilterCategory] = useState('all');
  const [showCreateComplaintModal, setShowCreateComplaintModal] = useState(false);
  const [showMyComplaintsModal, setShowMyComplaintsModal] = useState(false);
  const [myComplaints, setMyComplaints] = useState<ComplaintItem[]>([]);
  const [myComplaintsLoading, setMyComplaintsLoading] = useState(false);
  const [myComplaintsError, setMyComplaintsError] = useState('');
  const [communityForm, setCommunityForm] = useState({
    platform: 'Careem',
    category: 'other',
    description: '',
    is_anonymous: true,
  });

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

  const filteredPendingQueue = useMemo(() => {
    const workerNeedle = verifierWorkerFilter.trim().toLowerCase();
    const filtered = verifierQueue.filter((item) => {
      const matchesPlatform = verifierPlatformFilter === 'all' || item.platform === verifierPlatformFilter;
      const matchesWorker = !workerNeedle || item.worker_name.toLowerCase().includes(workerNeedle);
      return matchesPlatform && matchesWorker;
    });

    filtered.sort((a, b) => {
      const left = new Date(a.submitted_at || a.shift_date).getTime();
      const right = new Date(b.submitted_at || b.shift_date).getTime();
      return verifierSortOrder === 'newest' ? right - left : left - right;
    });

    return filtered;
  }, [verifierPlatformFilter, verifierQueue, verifierSortOrder, verifierWorkerFilter]);

  const pendingPlatformOptions = useMemo(() => {
    return Array.from(new Set(verifierQueue.map((item) => item.platform))).sort((a, b) => a.localeCompare(b));
  }, [verifierQueue]);

  const pendingByWorker = useMemo(() => {
    const grouped: Record<string, VerifierQueueItem[]> = {};
    for (const item of filteredPendingQueue) {
      const key = `${item.worker_name} (${item.worker_id.slice(0, 8)})`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }
    return grouped;
  }, [filteredPendingQueue]);

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

  async function loadCommunityBoard() {
    setCommunityLoading(true);
    setCommunityError('');
    try {
      const params = new URLSearchParams();
      if (communityFilterPlatform !== 'all') params.set('platform', communityFilterPlatform);
      if (communityFilterCategory !== 'all') params.set('category', communityFilterCategory);

      const { response, payload } = await fetchWithFallback(
        grievanceBases,
        `/complaints/public${params.toString() ? `?${params.toString()}` : ''}`,
      );

      if (!response.ok) {
        setCommunityError(getErrorMessage(payload, 'Could not load community feed'));
        return;
      }
      setCommunityItems(Array.isArray(payload) ? payload : []);
    } catch (error) {
      setCommunityError(getUnknownErrorMessage(error, 'Could not connect to grievance service'));
    } finally {
      setCommunityLoading(false);
    }
  }

  async function loadAdvocateComplaints() {
    setCommunityLoading(true);
    setCommunityError('');
    try {
      const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/advocate', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        setCommunityError(getErrorMessage(payload, 'Could not load advocate complaints'));
        return;
      }
      setAdvocateItems(Array.isArray(payload) ? payload : []);
    } catch (error) {
      setCommunityError(getUnknownErrorMessage(error, 'Could not connect to grievance service'));
    } finally {
      setCommunityLoading(false);
    }
  }

  async function submitCommunityComplaint(e: FormEvent) {
    e.preventDefault();
    setCommunityError('');
    setCommunitySuccess('');

    if (communityForm.description.trim().length < 20) {
      setCommunityError('Description must be at least 20 characters');
      return;
    }

    try {
      const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(communityForm),
      });

      if (!response.ok) {
        setCommunityError(getErrorMessage(payload, 'Could not submit complaint'));
        return;
      }

      setCommunitySuccess('Complaint submitted');
      setCommunityForm((prev) => ({ ...prev, description: '' }));
      setShowCreateComplaintModal(false);
      await loadCommunityBoard();
      await loadMyComplaints();
    } catch (error) {
      setCommunityError(getUnknownErrorMessage(error, 'Could not connect to grievance service'));
    }
  }

  async function loadMyComplaints() {
    if (user?.role !== 'worker') {
      return;
    }

    setMyComplaintsLoading(true);
    setMyComplaintsError('');
    try {
      const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/mine', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        setMyComplaintsError(getErrorMessage(payload, 'Could not load your complaints'));
        return;
      }

      setMyComplaints(Array.isArray(payload) ? payload : []);
    } catch (error) {
      setMyComplaintsError(getUnknownErrorMessage(error, 'Could not connect to grievance service'));
    } finally {
      setMyComplaintsLoading(false);
    }
  }

  async function moderateAdvocateComplaint(id: string, patch: Partial<ComplaintItem>) {
    setCommunityError('');
    setCommunitySuccess('');
    const body: Record<string, unknown> = {};
    if (patch.category) body.category = patch.category;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.tags) body.tags = patch.tags;

    const { response, payload } = await fetchWithFallback(grievanceBases, `/complaints/${id}/moderate`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      setCommunityError(getErrorMessage(payload, 'Could not moderate complaint'));
      return;
    }

    setAdvocateItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...payload } : item)));
    setCommunitySuccess('Complaint updated');
  }

  async function fetchProfile(authToken: string, currentUserId: string) {
    try {
      const { response: meRes, payload: mePayload } = await fetchWithFallback(authBases, '/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (meRes.ok) {
        setUser(mePayload);

        if (mePayload.role === 'worker') {
          setActiveSection('earnings');
        }
        if (mePayload.role === 'verifier') {
          setActiveSection('verifier');
        }
        if (mePayload.role === 'advocate') {
          setActiveSection('community');
        }

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
  }

  function validateCsvRow(row: CsvDraftRow) {
    const errors: string[] = [];
    const hours = Number(row.hours_worked);
    const gross = Number(row.gross_earned);
    const deductions = Number(row.platform_deductions);
    const net = Number(row.net_received);

    if (!platforms.includes(row.platform)) {
      errors.push('platform is invalid');
    }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.shift_date)) {
        errors.push(`shift_date must be YYYY-MM-DD (received: ${row.shift_date || 'empty'})`);
    }
    if (!Number.isFinite(hours) || hours <= 0) {
      errors.push('hours_worked must be > 0');
    }
    if (Number.isFinite(hours) && hours > 24) {
      errors.push('hours_worked cannot exceed 24');
    }
    if (!Number.isFinite(gross) || gross < 0) {
      errors.push('gross_earned must be >= 0');
    }
    if (!Number.isFinite(deductions) || deductions < 0) {
      errors.push('platform_deductions must be >= 0');
    }
    if (!Number.isFinite(net) || net < 0) {
      errors.push('net_received must be >= 0');
    }
    if (Number.isFinite(gross) && Number.isFinite(deductions) && Number.isFinite(net)) {
      if (Math.abs(net - (gross - deductions)) > 0.05) {
        errors.push('net_received must equal gross_earned - platform_deductions');
      }
    }

    return errors;
  }

  async function handleCsvFileSelect(file: File | null) {
    setCsvError('');
    setCsvRows([]);
    setCsvFileName('');

    if (!file) return;

    const isCsvFile = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');
    if (!isCsvFile) {
      setCsvError('Unsupported file type. Please upload a .csv file');
      return;
    }
    if (file.size > maxCsvBytes) {
      setCsvError('CSV file is too large. Max allowed size is 5MB');
      return;
    }

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      setCsvError('CSV must include a header row and at least one data row');
      return;
    }

    const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const missing = csvRequiredColumns.filter((col) => !header.includes(col));
    if (missing.length > 0) {
      setCsvError(`Missing required columns: ${missing.join(', ')}`);
      return;
    }

    const rows = lines.slice(1).map((line, idx): CsvDraftRow => {
      const cells = splitCsvLine(line);
      const valueOf = (key: string) => {
        const colIndex = header.indexOf(key);
        if (colIndex === -1) return '';
        return (cells[colIndex] || '').trim();
      };

      const rawShiftDate = valueOf('shift_date');
      const normalizedDate = normalizeCsvDate(rawShiftDate);

      const row: CsvDraftRow = {
        rowNumber: idx + 2,
        platform: valueOf('platform'),
        shift_date: normalizedDate.value,
        hours_worked: valueOf('hours_worked'),
        gross_earned: valueOf('gross_earned'),
        platform_deductions: valueOf('platform_deductions'),
        net_received: valueOf('net_received'),
        notes: valueOf('notes'),
        errors: [],
        uploaded: false,
        screenshotFile: null,
        screenshotFileName: '',
      };

      row.errors = validateCsvRow(row);
      if (normalizedDate.error) {
        row.errors.push(normalizedDate.error);
      }
      return row;
    });

    const totalsByDate: Record<string, number> = {};
    rows.forEach((row) => {
      if (!row.errors.length) {
        const current = totalsByDate[row.shift_date] || 0;
        totalsByDate[row.shift_date] = current + Number(row.hours_worked || 0);
      }
    });
    rows.forEach((row) => {
      const dailyTotal = totalsByDate[row.shift_date] || 0;
      if (dailyTotal > 24) {
        row.errors.push(`CSV daily total exceeds 24 hours for ${row.shift_date}`);
      }
    });

    setCsvFileName(file.name);
    setCsvRows(rows);
  }

  function selectCsvRowScreenshot(index: number, file: File | null) {
    if (!file) {
      setCsvRows((prev) =>
        prev.map((row, rowIndex) =>
          rowIndex === index
            ? { ...row, screenshotFile: null, screenshotFileName: '', uploaded: false, uploadedShiftId: undefined }
            : row,
        ),
      );
      return;
    }

    if (!supportedImageTypes.includes(file.type)) {
      setCsvRows((prev) =>
        prev.map((row, rowIndex) =>
          rowIndex === index ? { ...row, uploadError: 'Unsupported screenshot type. Allowed: JPG, PNG, WEBP' } : row,
        ),
      );
      return;
    }
    if (file.size > maxScreenshotBytes) {
      setCsvRows((prev) =>
        prev.map((row, rowIndex) =>
          rowIndex === index ? { ...row, uploadError: 'Screenshot is too large. Max 10MB' } : row,
        ),
      );
      return;
    }

    setCsvRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              screenshotFile: file,
              screenshotFileName: file.name,
              uploadError: '',
              uploaded: false,
              uploadedShiftId: undefined,
            }
          : row,
      ),
    );
  }

  async function uploadCsvRow(index: number) {
    if (!userId) {
      setCsvError('You must be logged in to upload CSV rows');
      return;
    }

    const row = csvRows[index];
    if (!row || row.uploaded || row.errors.length > 0 || !row.screenshotFile) {
      return;
    }

    setCsvBusy(true);
    setCsvError('');

    try {
      const payload = {
        worker_id: userId,
        platform: row.platform,
        shift_date: row.shift_date,
        hours_worked: Number(row.hours_worked),
        gross_earned: Number(row.gross_earned),
        platform_deductions: Number(row.platform_deductions),
        net_received: Number(row.net_received),
        notes: row.notes || null,
      };

      const { response, payload: apiPayload } = await fetchWithFallback(earningsBases, '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setCsvRows((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index
              ? { ...item, uploadError: getErrorMessage(apiPayload, 'Upload failed') }
              : item,
          ),
        );
        return;
      }

      let screenshotSaveResponse: Response;
      let screenshotSavePayload: any;
      try {
        const formData = new FormData();
        formData.append('worker_id', userId);
        formData.append('file', row.screenshotFile);

        const screenshotCall = await fetchWithFallback(earningsBases, `/${apiPayload.id}/screenshot`, {
          method: 'POST',
          body: formData,
        });
        screenshotSaveResponse = screenshotCall.response;
        screenshotSavePayload = screenshotCall.payload;
      } catch (error) {
        await fetchWithFallback(earningsBases, `/${apiPayload.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worker_id: userId }),
        });
        setCsvRows((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index
              ? { ...item, uploadError: getUnknownErrorMessage(error, 'Screenshot upload failed') }
              : item,
          ),
        );
        return;
      }

      if (!screenshotSaveResponse.ok) {
        await fetchWithFallback(earningsBases, `/${apiPayload.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worker_id: userId }),
        });
        setCsvRows((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  uploadError: getErrorMessage(screenshotSavePayload, 'Could not save screenshot for row'),
                }
              : item,
          ),
        );
        return;
      }

      setCsvRows((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, uploaded: true, uploadedShiftId: apiPayload.id, uploadError: '' }
            : item,
        ),
      );
      setShifts((prev) => [
        {
          ...apiPayload,
          screenshot_url: screenshotSavePayload?.file_url || null,
        },
        ...prev,
      ]);
    } catch (error) {
      setCsvRows((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, uploadError: getUnknownErrorMessage(error, 'Upload failed') }
            : item,
        ),
      );
    } finally {
      setCsvBusy(false);
    }
  }

  async function uploadAllValidCsvRows() {
    const targets = csvRows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !row.uploaded && isCsvRowReady(row));

    for (const target of targets) {
      // eslint-disable-next-line no-await-in-loop
      await uploadCsvRow(target.index);
    }
  }

  function beginEditShift(shift: Shift) {
    setEditingShiftId(shift.id);
    setEditForm({
      platform: shift.platform,
      shift_date: shift.shift_date,
      hours_worked: String(shift.hours_worked),
      gross_earned: String(shift.gross_earned),
      platform_deductions: String(shift.platform_deductions),
      notes: shift.notes || '',
    });
  }

  async function saveShiftEdit(e: FormEvent) {
    e.preventDefault();

    if (!userId || !editingShiftId || !editForm) {
      setEarningsError('Unable to save changes');
      return;
    }

    const gross = Number(editForm.gross_earned);
    const deductions = Number(editForm.platform_deductions);
    const hours = Number(editForm.hours_worked);
    const net = Number((gross - deductions).toFixed(2));

    if (!Number.isFinite(gross) || !Number.isFinite(deductions) || !Number.isFinite(hours) || hours <= 0) {
      setEarningsError('Please provide valid numeric values for edit');
      return;
    }

    const { response, payload } = await fetchWithFallback(earningsBases, `/${editingShiftId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_id: userId,
        platform: editForm.platform,
        shift_date: editForm.shift_date,
        hours_worked: hours,
        gross_earned: gross,
        platform_deductions: deductions,
        net_received: net,
        notes: editForm.notes || null,
      }),
    });

    if (!response.ok) {
      setEarningsError(getErrorMessage(payload, 'Could not update shift'));
      return;
    }

    setShifts((prev) => prev.map((item) => (item.id === editingShiftId ? payload : item)));
    setEditingShiftId(null);
    setEditForm(null);
    setEarningsSuccess('Shift updated successfully');
  }

  async function deleteShift(shiftId: string) {
    if (!userId) return;

    const { response, payload } = await fetchWithFallback(earningsBases, `/${shiftId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id: userId }),
    });

    if (!response.ok) {
      setEarningsError(getErrorMessage(payload, 'Could not delete shift'));
      return;
    }

    setShifts((prev) => prev.filter((item) => item.id !== shiftId));
    setCsvRows((prev) =>
      prev.map((row) =>
        row.uploadedShiftId === shiftId
          ? {
              ...row,
              uploaded: false,
              uploadedShiftId: undefined,
              uploadError: '',
            }
          : row,
      ),
    );
    if (editingShiftId === shiftId) {
      setEditingShiftId(null);
      setEditForm(null);
    }
    setEarningsSuccess('Shift deleted successfully');
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
    setCommunityError('');
    setCommunitySuccess('');
    setShowCreateComplaintModal(false);
    setShowMyComplaintsModal(false);
    setMyComplaints([]);
    setMyComplaintsLoading(false);
    setMyComplaintsError('');
    setPreviewScreenshotUrl(null);
    setAuthError('');
    setEarningsError('');
    setEarningsSuccess('');
  }

  if (token && userId && !user) {
    void fetchProfile(token, userId);
  }

  useEffect(() => {
    if (user?.role === 'worker' || user?.role === 'advocate') {
      void loadCommunityBoard();
    }
  }, [communityFilterCategory, communityFilterPlatform, user?.role]);

  useEffect(() => {
    if (showMyComplaintsModal && user?.role === 'worker') {
      void loadMyComplaints();
    }
  }, [showMyComplaintsModal, user?.role]);

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
    <main className="min-h-screen bg-slate-100 lg:flex">
      <aside className="border-b border-slate-800 bg-slate-950 px-4 py-4 text-slate-100 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <div className="mb-4 border-b border-slate-800 pb-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">FairGig Workspace</p>
          <h2 className="mt-2 text-lg font-bold">Dashboard</h2>
          <p className="mt-1 text-xs text-slate-400">{user?.name || 'User'} · {user?.role || 'unknown'}</p>
        </div>

        <nav className="space-y-1.5">
          <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">Navigation</p>
          {user?.role === 'worker' && (
            <>
              <button
                type="button"
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${activeSection === 'earnings' ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-700 hover:bg-slate-800'}`}
                onClick={() => setActiveSection('earnings')}
              >
                Earnings
              </button>
              <button
                type="button"
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${activeSection === 'community' ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-700 hover:bg-slate-800'}`}
                onClick={() => setActiveSection('community')}
              >
                Community Board
              </button>
            </>
          )}

          {user?.role === 'advocate' && (
            <>
              <button
                type="button"
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${activeSection === 'community' ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-700 hover:bg-slate-800'}`}
                onClick={() => setActiveSection('community')}
              >
                Community Board
              </button>
              <button
                type="button"
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${activeSection === 'advocate' ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-700 hover:bg-slate-800'}`}
                onClick={() => {
                  setActiveSection('advocate');
                  void loadAdvocateComplaints();
                }}
              >
                Advocate Panel
              </button>
            </>
          )}

          {user?.role === 'verifier' && (
            <button
              type="button"
              className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${activeSection === 'verifier' ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-700 hover:bg-slate-800'}`}
              onClick={() => setActiveSection('verifier')}
            >
              Verifier Queue
            </button>
          )}
        </nav>

        <button
          type="button"
          onClick={logout}
          className="mt-6 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          Logout
        </button>
      </aside>

      <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Earnings Service</h1>
              <p className="text-sm text-slate-600">
                Logged in as <span className="font-semibold">{user?.name || 'User'}</span> ({user?.role || 'unknown'})
              </p>
            </div>
            {activeSection === 'community' && (
              <button
                type="button"
                onClick={() => void loadCommunityBoard()}
                className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:mt-0"
              >
                Refresh Board
              </button>
            )}
          </header>

          <section>
        {user?.role === 'worker' ? (
          activeSection === 'community' ? (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Community Board</h2>
                  <p className="text-xs text-slate-500">Reddit-style public feed of worker complaints and platform trends.</p>
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

              {communityError && <p className="text-sm font-medium text-red-600">{communityError}</p>}
              {communitySuccess && <p className="text-sm font-medium text-emerald-700">{communitySuccess}</p>}

              {communityLoading ? (
                <p className="text-sm text-slate-600">Loading community feed...</p>
              ) : communityItems.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No posts found for selected filters.</p>
              ) : (
                <div className="space-y-3">
                  {communityItems.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="w-14 shrink-0 rounded-lg bg-slate-100 px-2 py-3 text-center">
                        <p className="text-lg font-black text-slate-900">{item.upvotes ?? 0}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">votes</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                          {item.platform} · {item.category}
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900">{item.description.slice(0, 90)}</h3>
                        <p className="mt-1 text-sm text-slate-700">{item.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold capitalize text-slate-700">{item.status}</span>
                          <span>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Unknown date'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Add Earnings</h2>

              <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  className={`w-1/2 rounded-lg px-3 py-2 text-sm font-semibold ${entryMode === 'manual' ? 'bg-white shadow' : 'text-slate-600'}`}
                  onClick={() => {
                    setEntryMode('manual');
                    setCsvError('');
                  }}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className={`w-1/2 rounded-lg px-3 py-2 text-sm font-semibold ${entryMode === 'csv' ? 'bg-white shadow' : 'text-slate-600'}`}
                  onClick={() => {
                    setEntryMode('csv');
                    setEarningsError('');
                  }}
                >
                  CSV Upload
                </button>
              </div>

              {entryMode === 'manual' ? (
                <form onSubmit={handleAddEarning} className="space-y-3">
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

                  <label className="block text-sm font-medium text-slate-700">Screenshot (required)</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    required
                    onChange={(e) => {
                      const selected = e.target.files?.[0] || null;
                      if (!selected) {
                        setScreenshotFile(null);
                        return;
                      }
                      if (!supportedImageTypes.includes(selected.type)) {
                        setEarningsError('Unsupported screenshot type. Allowed: JPG, PNG, WEBP');
                        setScreenshotFile(null);
                        return;
                      }
                      if (selected.size > maxScreenshotBytes) {
                        setEarningsError('Screenshot is too large. Max allowed size is 10MB');
                        setScreenshotFile(null);
                        return;
                      }
                      setEarningsError('');
                      setScreenshotFile(selected);
                    }}
                  />
                  <p className="text-xs text-slate-500">Unsupported types (like PDF) and files above 10MB are rejected.</p>

                  <button
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    type="submit"
                    disabled={earningsLoading}
                  >
                    {earningsLoading ? 'Saving...' : 'Add Earning'}
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">
                    Upload CSV using columns: <span className="font-semibold">{csvRequiredColumns.join(', ')}</span>
                  </p>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    onChange={(e) => {
                      const selected = e.target.files?.[0] || null;
                      void handleCsvFileSelect(selected);
                    }}
                  />
                  {csvFileName && <p className="text-xs text-slate-500">Loaded: {csvFileName}</p>}
                  {csvError && <p className="text-sm font-medium text-red-600">{csvError}</p>}

                  {csvRows.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-600">
                          {csvRows.length} rows parsed. Invalid rows are not uploaded until fixed in CSV and reloaded.
                        </p>
                        <button
                          type="button"
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={csvBusy || csvRows.every((row) => row.uploaded || row.errors.length > 0)}
                          onClick={() => void uploadAllValidCsvRows()}
                        >
                          Upload All Valid
                        </button>
                      </div>

                      <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-xs">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-2 py-2 text-left">#</th>
                              <th className="px-2 py-2 text-left">Platform</th>
                              <th className="px-2 py-2 text-left">Date</th>
                              <th className="px-2 py-2 text-left">Hours</th>
                              <th className="px-2 py-2 text-left">Gross</th>
                              <th className="px-2 py-2 text-left">Deductions</th>
                              <th className="px-2 py-2 text-left">Net</th>
                              <th className="px-2 py-2 text-left">Screenshot</th>
                              <th className="px-2 py-2 text-left">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {csvRows.map((row, index) => (
                              <tr
                                key={`${row.rowNumber}-${index}`}
                                className={
                                  row.uploaded
                                    ? 'bg-emerald-100/70'
                                    : isCsvRowReady(row)
                                      ? 'bg-emerald-50'
                                      : ''
                                }
                              >
                                <td className="px-2 py-2">{row.rowNumber}</td>
                                <td className="px-2 py-2">{row.platform}</td>
                                <td className="px-2 py-2">{row.shift_date}</td>
                                <td className="px-2 py-2">{row.hours_worked}</td>
                                <td className="px-2 py-2">{row.gross_earned}</td>
                                <td className="px-2 py-2">{row.platform_deductions}</td>
                                <td className="px-2 py-2">{row.net_received}</td>
                                <td className="px-2 py-2">
                                  <label className="inline-flex cursor-pointer items-center rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                                    Choose Image
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp"
                                      className="hidden"
                                      onChange={(e) => selectCsvRowScreenshot(index, e.target.files?.[0] || null)}
                                    />
                                  </label>
                                  <div className="mt-1 text-[10px] text-slate-500">
                                    {row.screenshotFileName || 'No image selected'}
                                  </div>
                                </td>
                                <td className="px-2 py-2">
                                  {row.uploaded ? (
                                    <span className="rounded bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">Uploaded</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="rounded bg-emerald-600 px-2 py-1 font-semibold text-white disabled:opacity-60"
                                      disabled={csvBusy || !isCsvRowReady(row)}
                                      onClick={() => void uploadCsvRow(index)}
                                    >
                                      Upload
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-2">
                        {csvRows
                          .filter((row) => row.errors.length > 0 || row.uploadError || !row.screenshotFile)
                          .map((row, index) => (
                            <div key={`err-${row.rowNumber}-${index}`} className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                              Row {row.rowNumber}:{' '}
                              {[...row.errors, !row.screenshotFile ? 'screenshot image is required' : '', row.uploadError || '']
                                .filter(Boolean)
                                .join(' | ')}
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {earningsError && <p className="text-sm font-medium text-red-600">{earningsError}</p>}
              {earningsSuccess && <p className="text-sm font-medium text-emerald-700">{earningsSuccess}</p>}
            </section>

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
                        <th className="px-2 py-2">Actions</th>
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
                          <td className="px-2 py-2">
                            {shift.verification_status === 'pending' ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white"
                                  onClick={() => beginEditShift(shift)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                                  onClick={() => void deleteShift(shift.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Locked after review</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {editingShiftId && editForm && (
                <form onSubmit={saveShiftEdit} className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <h3 className="text-sm font-semibold text-slate-800">Edit Pending Shift</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={editForm.platform}
                      onChange={(e) => setEditForm((prev) => (prev ? { ...prev, platform: e.target.value } : prev))}
                    >
                      {platforms.map((platform) => (
                        <option key={platform} value={platform}>
                          {platform}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={editForm.shift_date}
                      onChange={(e) => setEditForm((prev) => (prev ? { ...prev, shift_date: e.target.value } : prev))}
                    />
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={editForm.hours_worked}
                      onChange={(e) => setEditForm((prev) => (prev ? { ...prev, hours_worked: e.target.value } : prev))}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={editForm.gross_earned}
                      onChange={(e) => setEditForm((prev) => (prev ? { ...prev, gross_earned: e.target.value } : prev))}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={editForm.platform_deductions}
                      onChange={(e) =>
                        setEditForm((prev) => (prev ? { ...prev, platform_deductions: e.target.value } : prev))
                      }
                    />
                    <input
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={editForm.notes}
                      onChange={(e) => setEditForm((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                      placeholder="Notes"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white" type="submit">
                      Save
                    </button>
                    <button
                      className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                      type="button"
                      onClick={() => {
                        setEditingShiftId(null);
                        setEditForm(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </section>
          </section>
          )
        ) : user?.role === 'verifier' ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Pending Worker Entries</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  {filteredPendingQueue.length} / {verifierQueue.length} pending
                </span>
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
                            {entry.screenshot_url && (
                              <button
                                type="button"
                                className="mt-2 overflow-hidden rounded-lg border border-slate-300 bg-white"
                                onClick={() => setPreviewScreenshotUrl(entry.screenshot_url || null)}
                              >
                                <img
                                  src={entry.screenshot_url}
                                  alt="Reviewed shift proof"
                                  className="h-16 w-28 object-cover"
                                />
                              </button>
                            )}
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
        ) : user?.role === 'advocate' ? (
          activeSection === 'community' ? (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Community Board</h2>
                <p className="text-xs text-slate-500">Advocate view of public trend feed</p>
              </div>
              {communityError && <p className="text-sm font-medium text-red-600">{communityError}</p>}
              {communitySuccess && <p className="text-sm font-medium text-emerald-700">{communitySuccess}</p>}
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
              {communityLoading ? (
                <p className="text-sm text-slate-600">Loading community feed...</p>
              ) : communityItems.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No posts found for selected filters.</p>
              ) : (
                <div className="space-y-3">
                  {communityItems.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="w-14 shrink-0 rounded-lg bg-slate-100 px-2 py-3 text-center">
                        <p className="text-lg font-black text-slate-900">{item.upvotes ?? 0}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">votes</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                          {item.platform} · {item.category}
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900">{item.description.slice(0, 90)}</h3>
                        <p className="mt-1 text-sm text-slate-700">{item.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold capitalize text-slate-700">{item.status}</span>
                          <span>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Unknown date'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Advocate Moderation Panel</h2>
              {communityLoading ? (
                <p className="text-sm text-slate-600">Loading complaints...</p>
              ) : advocateItems.length === 0 ? (
                <p className="text-sm text-slate-600">No complaints available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-2 py-2 text-left">Worker</th>
                        <th className="px-2 py-2 text-left">Platform</th>
                        <th className="px-2 py-2 text-left">Category</th>
                        <th className="px-2 py-2 text-left">Description</th>
                        <th className="px-2 py-2 text-left">Tags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {advocateItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-2 py-2">
                            <div className="font-semibold text-slate-800">{item.worker_name || item.worker_id || 'N/A'}</div>
                            <div className="text-[11px] text-slate-500">{item.worker_id || '—'}</div>
                          </td>
                          <td className="px-2 py-2">{item.platform}</td>
                          <td className="px-2 py-2">
                            <select
                              className="rounded border border-slate-300 px-2 py-1"
                              value={item.category}
                              onChange={(e) => void moderateAdvocateComplaint(item.id, { category: e.target.value as any })}
                            >
                              <option value="commission_hike">commission_hike</option>
                              <option value="account_deactivation">account_deactivation</option>
                              <option value="payment_delay">payment_delay</option>
                              <option value="unfair_rating">unfair_rating</option>
                              <option value="data_privacy">data_privacy</option>
                              <option value="other">other</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <textarea
                              className="min-h-16 w-56 rounded border border-slate-300 px-2 py-1"
                              defaultValue={item.description}
                              onBlur={(e) => void moderateAdvocateComplaint(item.id, { description: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              className="w-40 rounded border border-slate-300 px-2 py-1"
                              defaultValue={(item.tags || []).join(',')}
                              onBlur={(e) =>
                                void moderateAdvocateComplaint(item.id, {
                                  tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                                })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        ) : (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            Earnings entry is available for worker accounts. You are logged in as {user?.role}.
          </section>
        )}
          </section>
        </div>

        {showCreateComplaintModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowCreateComplaintModal(false)}
          >
            <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">New Complaint</h3>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                  onClick={() => setShowCreateComplaintModal(false)}
                >
                  Close
                </button>
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