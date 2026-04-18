import type { CsvDraftRow } from './types';

export function joinBase(base: string, endpoint: string) {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
}

export async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

export async function fetchWithFallback(
  bases: string[],
  endpoint: string,
  options?: RequestInit,
): Promise<{ response: Response; payload: any }> {
  let lastError: unknown;

  for (let i = 0; i < bases.length; i++) {
    const base = bases[i];
    try {
      const response = await fetch(joinBase(base, endpoint), options);
      const payload = await parseJsonSafe(response);

      // Only try the next base when this one is 404 *and* there is another base left.
      // Previously, a 404 on the last base was skipped and the function threw — so
      // `http://localhost:8005/...` never "won" over `/api/...` on the dev server.
      if (response.status === 404 && i < bases.length - 1) {
        continue;
      }

      return { response, payload };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

export function getErrorMessage(payload: any, fallback: string) {
  const detail = payload?.detail;
  const message = payload?.message;

  if (typeof detail === 'string' && detail.trim()) return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      const msg = (first as any).msg || (first as any).message;
      const loc = Array.isArray((first as any).loc) ? (first as any).loc.join('.') : '';
      if (msg && loc) return `${loc}: ${msg}`;
      if (msg) return msg;
    }
    return fallback;
  }

  if (detail && typeof detail === 'object') {
    const msg = (detail as any).msg || (detail as any).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }

  if (typeof message === 'string' && message.trim()) return message;

  return fallback;
}

export function getUnknownErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function isCsvRowReady(row: CsvDraftRow) {
  return row.errors.length === 0 && !!row.screenshotFile;
}

export function splitCsvLine(line: string) {
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

export function normalizeCsvDate(input: string) {
  const value = (input || '').trim();
  if (!value) {
    return { value: '', error: 'shift_date is required' };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { value };
  }

  const compact = value.replace(/\./g, '/').replace(/-/g, '/');
  const parts = compact.split('/').map((p) => p.trim());

  if (parts.length === 3) {
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

    if (/^\d{4}$/.test(parts[2])) {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      const y = Number(parts[2]);

      let d = a;
      let m = b;

      if (a > 12 && b <= 12) {
        d = a;
        m = b;
      } else if (b > 12 && a <= 12) {
        m = a;
        d = b;
      } else {
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
