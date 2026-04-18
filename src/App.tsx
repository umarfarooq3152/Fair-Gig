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

type ComplaintCluster = {
  id: string;
  name: string;
  platform?: string | null;
  primary_tag?: string | null;
  complaint_count?: number;
};

type ComplaintSpike = {
  platform: string;
  category: string;
  count: number;
  first_seen_at?: string;
  latest_seen_at?: string;
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
  const [selectedAdvocateIds, setSelectedAdvocateIds] = useState<string[]>([]);
  const [clusterName, setClusterName] = useState('Systemic Issue Cluster');
  const [clusterTag, setClusterTag] = useState('payment_delay');
  const [bulkTagsInput, setBulkTagsInput] = useState('');
  const [existingClusterId, setExistingClusterId] = useState('');
  const [advocateActionBusy, setAdvocateActionBusy] = useState(false);
  const [complaintClusters, setComplaintClusters] = useState<ComplaintCluster[]>([]);
  const [complaintSpikes, setComplaintSpikes] = useState<ComplaintSpike[]>([]);
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

  const selectedAdvocateItems = useMemo(
    () => advocateItems.filter((item) => selectedAdvocateIds.includes(item.id)),
    [advocateItems, selectedAdvocateIds],
  );

  const selectedClusterId = useMemo(() => {
    const clusterIds = Array.from(new Set(selectedAdvocateItems.map((item) => item.cluster_id).filter(Boolean))) as string[];
    return clusterIds.length === 1 ? clusterIds[0] : '';
  }, [selectedAdvocateItems]);

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

  async function loadComplaintClusters() {
    try {
      const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/clusters?limit=100', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.ok) {
        setComplaintClusters(Array.isArray(payload) ? payload : []);
      }
    } catch {
      setComplaintClusters([]);
    }
  }

  async function loadComplaintSpikes() {
    try {
      const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/alerts/spikes?window_hours=3&min_count=5', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.ok) {
        setComplaintSpikes(Array.isArray(payload?.items) ? payload.items : []);
      }
    } catch {
      setComplaintSpikes([]);
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

  function toggleAdvocateSelection(id: string) {
    setSelectedAdvocateIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function toggleAllAdvocateSelection(checked: boolean) {
    if (!checked) {
      setSelectedAdvocateIds([]);
      return;
    }
    setSelectedAdvocateIds(advocateItems.map((item) => item.id));
  }

  async function assignTagsToSelectedComplaints() {
    const tags = bulkTagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (selectedAdvocateIds.length < 1) {
      setCommunityError('Select at least one complaint first');
      return;
    }
    if (!tags.length) {
      setCommunityError('Enter one or more tags separated by commas');
      return;
    }

    setAdvocateActionBusy(true);
    setCommunityError('');
    setCommunitySuccess('');
    try {
      const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/bulk/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ complaint_ids: selectedAdvocateIds, tags }),
      });

      if (!response.ok) {
        setCommunityError(getErrorMessage(payload, 'Could not assign tags'));
        return;
      }

      setAdvocateItems((prev) => prev.map((item) => (selectedAdvocateIds.includes(item.id) ? { ...item, tags } : item)));
      setSelectedAdvocateIds([]);
      setCommunitySuccess(`Assigned tags to ${payload?.updated_count || 0} complaints`);
    } catch (error) {
      setCommunityError(getUnknownErrorMessage(error, 'Could not connect to grievance service'));
    } finally {
      setAdvocateActionBusy(false);
    }
  }

  async function createClusterFromSelected() {
    if (selectedAdvocateIds.length < 2) {
      setCommunityError('Select at least two complaints to create a cluster');
      return;
    }

    setAdvocateActionBusy(true);
    setCommunityError('');
    setCommunitySuccess('');
    try {
      const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          complaint_ids: selectedAdvocateIds,
          name: clusterName || `Cluster ${new Date().toLocaleString()}`,
          primary_tag: clusterTag || 'untagged',
          platform: selectedAdvocateItems[0]?.platform || null,
        }),
      });

      if (!response.ok) {
        setCommunityError(getErrorMessage(payload, 'Could not create cluster'));
        return;
      }

      const clusterId = payload?.cluster?.id;
      const linkedIds: string[] = payload?.linked_complaint_ids || [];
      setAdvocateItems((prev) =>
        prev.map((item) =>
          linkedIds.includes(item.id)
            ? { ...item, cluster_id: clusterId }
            : item,
        ),
      );
      setSelectedAdvocateIds([]);
      setCommunitySuccess(`Cluster created. Linked ${payload?.linked_count || 0} complaints.`);
      await loadComplaintClusters();
    } catch (error) {
      setCommunityError(getUnknownErrorMessage(error, 'Could not connect to grievance service'));
    } finally {
      setAdvocateActionBusy(false);
    }
  }

  async function addToExistingCluster() {
    if (!existingClusterId) {
      setCommunityError('Select an existing cluster first');
      return;
    }
    if (selectedAdvocateIds.length < 1) {
      setCommunityError('Select at least one complaint');
      return;
    }

    setAdvocateActionBusy(true);
    setCommunityError('');
    setCommunitySuccess('');
    try {
      const { response, payload } = await fetchWithFallback(grievanceBases, `/complaints/cluster/${existingClusterId}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ complaint_ids: selectedAdvocateIds }),
      });

      if (!response.ok) {
        setCommunityError(getErrorMessage(payload, 'Could not add complaints to cluster'));
        return;
      }

      const linkedIds: string[] = payload?.linked_complaint_ids || [];
      setAdvocateItems((prev) =>
        prev.map((item) =>
          linkedIds.includes(item.id)
            ? { ...item, cluster_id: existingClusterId }
            : item,
        ),
      );
      setSelectedAdvocateIds([]);
      setCommunitySuccess(`Added ${payload?.linked_count || 0} complaints to existing cluster.`);
      await loadComplaintClusters();
    } catch (error) {
      setCommunityError(getUnknownErrorMessage(error, 'Could not connect to grievance service'));
    } finally {
      setAdvocateActionBusy(false);
    }
  }

  async function setSelectedComplaintStatus(nextStatus: 'escalated' | 'resolved') {
    if (selectedAdvocateIds.length < 1) {
      setCommunityError('Select at least one complaint first');
      return;
    }

    setAdvocateActionBusy(true);
    setCommunityError('');
    setCommunitySuccess('');
    try {
      if (selectedClusterId) {
        const { response, payload } = await fetchWithFallback(grievanceBases, `/complaints/cluster/${selectedClusterId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status: nextStatus }),
        });

        if (!response.ok) {
          setCommunityError(getErrorMessage(payload, 'Could not update cluster status'));
          return;
        }

        setAdvocateItems((prev) => prev.map((item) => (item.cluster_id === selectedClusterId ? { ...item, status: nextStatus } : item)));
        setCommunitySuccess(`Cluster cascade applied to ${payload?.affected_count || 0} complaints.`);
      } else {
        const { response, payload } = await fetchWithFallback(grievanceBases, '/complaints/bulk/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ complaint_ids: selectedAdvocateIds, status: nextStatus }),
        });

        if (!response.ok) {
          setCommunityError(getErrorMessage(payload, 'Could not update complaint status'));
          return;
        }

        setAdvocateItems((prev) => prev.map((item) => (selectedAdvocateIds.includes(item.id) ? { ...item, status: nextStatus } : item)));
        setCommunitySuccess(`Updated ${payload?.updated_count || 0} complaints to ${nextStatus}.`);
      }

      setSelectedAdvocateIds([]);
    } catch (error) {
      setCommunityError(getUnknownErrorMessage(error, 'Could not connect to grievance service'));
    } finally {
      setAdvocateActionBusy(false);
    }
  }

  async function unclusterComplaint(id: string) {
    setCommunityError('');
    setCommunitySuccess('');
    try {
      const { response, payload } = await fetchWithFallback(grievanceBases, `/complaints/${id}/uncluster`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        setCommunityError(getErrorMessage(payload, 'Could not un-cluster complaint'));
        return;
      }

      setAdvocateItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...payload } : item)));
      setCommunitySuccess('Complaint removed from cluster and moved back to open');
      await loadComplaintClusters();
    } catch (error) {
      setCommunityError(getUnknownErrorMessage(error, 'Could not connect to grievance service'));
    }
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
    setSelectedAdvocateIds([]);
    setComplaintClusters([]);
    setComplaintSpikes([]);
    setExistingClusterId('');
    setBulkTagsInput('');
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
    if (user?.role === 'advocate') {
      if (activeSection === 'advocate') {
        void loadAdvocateComplaints();
        void loadComplaintClusters();
      }
      void loadComplaintSpikes();
    }
  }, [activeSection, user?.role]);

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
              )}
            </section>
          ) : (
            <section className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[1fr,280px]">
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-slate-900">Advocate Moderation Queue</h2>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      onClick={() => {
                        void loadAdvocateComplaints();
                        void loadComplaintSpikes();
                        void loadComplaintClusters();
                      }}
                    >
                      Refresh Queue
                    </button>
                  </div>

                  {communityLoading ? (
                    <p className="text-sm text-slate-600">Loading complaints...</p>
                  ) : advocateItems.length === 0 ? (
                    <p className="text-sm text-slate-600">No complaints available.</p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="grid grid-cols-[32px,150px,120px,1fr,130px,140px] gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        <label className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={advocateItems.length > 0 && selectedAdvocateIds.length === advocateItems.length}
                            onChange={(e) => toggleAllAdvocateSelection(e.target.checked)}
                          />
                        </label>
                        <span>Time</span>
                        <span>Platform</span>
                        <span>Preview</span>
                        <span>Status</span>
                        <span>Cluster</span>
                      </div>
                      <div className="max-h-[65vh] overflow-auto">
                        {advocateItems.map((item) => (
                          <div key={item.id} className="grid grid-cols-[32px,150px,120px,1fr,130px,140px] gap-2 border-b border-slate-100 px-2 py-2 text-xs text-slate-700">
                            <label className="flex items-start justify-center pt-1">
                              <input
                                type="checkbox"
                                checked={selectedAdvocateIds.includes(item.id)}
                                onChange={() => toggleAdvocateSelection(item.id)}
                              />
                            </label>
                            <div>
                              <p>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</p>
                              <p className="truncate text-[11px] text-slate-500">{item.worker_name || item.worker_id || 'Unknown'}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{item.platform}</p>
                              <select
                                className="mt-1 w-full rounded border border-slate-300 px-1 py-0.5 text-[11px]"
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
                            </div>
                            <div className="space-y-1">
                              <p className="truncate font-semibold text-slate-900">{item.description.slice(0, 85)}</p>
                              <textarea
                                className="h-12 w-full rounded border border-slate-300 px-2 py-1 text-[11px]"
                                defaultValue={item.description}
                                onBlur={(e) => void moderateAdvocateComplaint(item.id, { description: e.target.value })}
                              />
                              <input
                                className="w-full rounded border border-slate-300 px-2 py-1 text-[11px]"
                                defaultValue={(item.tags || []).join(',')}
                                onBlur={(e) =>
                                  void moderateAdvocateComplaint(item.id, {
                                    tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                                  item.status === 'resolved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.status === 'escalated'
                                      ? 'bg-amber-100 text-amber-800'
                                      : item.status === 'rejected'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {item.status}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <p className="truncate text-[11px] text-slate-500">{item.cluster_id || 'Unclustered'}</p>
                              {item.cluster_id && (
                                <button
                                  type="button"
                                  className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
                                  onClick={() => void unclusterComplaint(item.id)}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <aside className="space-y-3">
                  <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900">Spike Alert (3h)</h3>
                    <div className="mt-2 space-y-2">
                      {complaintSpikes.length === 0 ? (
                        <p className="text-xs text-slate-500">No major spikes detected.</p>
                      ) : (
                        complaintSpikes.slice(0, 8).map((spike) => (
                          <div key={`${spike.platform}-${spike.category}`} className="rounded border border-amber-200 bg-amber-50 p-2">
                            <p className="text-xs font-semibold text-amber-900">{spike.platform} · {spike.category}</p>
                            <p className="text-[11px] text-amber-800">{spike.count} complaints in last 3h</p>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900">Existing Clusters</h3>
                    <select
                      className="mt-2 w-full rounded border border-slate-300 px-2 py-2 text-xs"
                      value={existingClusterId}
                      onChange={(e) => setExistingClusterId(e.target.value)}
                    >
                      <option value="">Select cluster</option>
                      {complaintClusters.map((cluster) => (
                        <option key={cluster.id} value={cluster.id}>
                          {cluster.name} ({cluster.complaint_count || 0})
                        </option>
                      ))}
                    </select>
                  </section>
                </aside>
              </div>

              {selectedAdvocateIds.length > 0 && (
                <section className="sticky bottom-3 z-20 rounded-xl border border-slate-900 bg-slate-950 p-3 shadow-xl">
                  <p className="mb-2 text-sm font-semibold text-white">{selectedAdvocateIds.length} selected</p>
                  <div className="grid gap-2 md:grid-cols-6">
                    <input
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100"
                      placeholder="Assign tags (comma-separated)"
                      value={bulkTagsInput}
                      onChange={(e) => setBulkTagsInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-900 disabled:opacity-60"
                      disabled={advocateActionBusy}
                      onClick={() => void assignTagsToSelectedComplaints()}
                    >
                      Assign Tags
                    </button>
                    <input
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100"
                      placeholder="New cluster name"
                      value={clusterName}
                      onChange={(e) => setClusterName(e.target.value)}
                    />
                    <input
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100"
                      placeholder="Primary tag"
                      value={clusterTag}
                      onChange={(e) => setClusterTag(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded bg-sky-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      disabled={advocateActionBusy}
                      onClick={() => void createClusterFromSelected()}
                    >
                      Create Cluster
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-700 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      disabled={advocateActionBusy}
                      onClick={() => void addToExistingCluster()}
                    >
                      Add To Existing
                    </button>
                    <button
                      type="button"
                      className="rounded bg-amber-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      disabled={advocateActionBusy}
                      onClick={() => void setSelectedComplaintStatus('escalated')}
                    >
                      Mark Escalated
                    </button>
                    <button
                      type="button"
                      className="rounded bg-emerald-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      disabled={advocateActionBusy}
                      onClick={() => void setSelectedComplaintStatus('resolved')}
                    >
                      Mark Resolved
                    </button>
                  </div>
                </section>
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