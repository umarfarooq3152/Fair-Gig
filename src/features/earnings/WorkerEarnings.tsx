import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  csvRequiredColumns,
  earningsBases,
  maxCsvBytes,
  maxScreenshotBytes,
  platforms,
  supportedImageTypes,
} from '../app/config';
import {
  fetchWithFallback,
  getErrorMessage,
  isCsvRowReady,
  normalizeCsvDate,
  splitCsvLine,
} from '../app/helpers';
import type { CsvDraftRow, Shift } from '../app/types';

type Props = {
  workerId: string;
};

export default function WorkerEarnings({ workerId }: Props) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [entryMode, setEntryMode] = useState<'manual' | 'csv'>('manual');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvRows, setCsvRows] = useState<CsvDraftRow[]>([]);
  const [csvBusy, setCsvBusy] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    platform: 'Careem',
    shift_date: '',
    hours_worked: '0',
    gross_earned: '0',
    platform_deductions: '0',
    notes: '',
  });
  const [form, setForm] = useState({
    platform: 'Careem',
    shift_date: new Date().toISOString().slice(0, 10),
    hours_worked: '8',
    gross_earned: '2400',
    platform_deductions: '600',
    notes: '',
  });

  const net = useMemo(() => Math.max(0, Number(form.gross_earned || 0) - Number(form.platform_deductions || 0)), [form.gross_earned, form.platform_deductions]);

  async function loadShifts() {
    setLoading(true);
    const { response, payload } = await fetchWithFallback(earningsBases, `?worker_id=${encodeURIComponent(workerId)}`);
    setLoading(false);
    if (!response.ok) {
      setError(getErrorMessage(payload, 'Could not load shifts'));
      return;
    }
    setShifts(Array.isArray(payload) ? payload : []);
  }

  useEffect(() => {
    void loadShifts();
  }, [workerId]);

  function validateCsvRow(row: CsvDraftRow) {
    const errors: string[] = [];
    const hours = Number(row.hours_worked);
    const gross = Number(row.gross_earned);
    const deductions = Number(row.platform_deductions);
    const netReceived = Number(row.net_received);

    if (!platforms.includes(row.platform)) {
      errors.push('platform is invalid');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.shift_date)) {
      errors.push('shift_date must be YYYY-MM-DD');
    }
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      errors.push('hours_worked must be between 0 and 24');
    }
    if (!Number.isFinite(gross) || gross < 0) {
      errors.push('gross_earned must be non-negative');
    }
    if (!Number.isFinite(deductions) || deductions < 0) {
      errors.push('platform_deductions must be non-negative');
    }
    if (!Number.isFinite(netReceived) || netReceived < 0) {
      errors.push('net_received must be non-negative');
    }
    if (Number.isFinite(gross) && Number.isFinite(deductions) && Number.isFinite(netReceived)) {
      if (Math.abs(netReceived - (gross - deductions)) > 0.05) {
        errors.push('net_received must equal gross_earned - platform_deductions');
      }
    }

    return errors;
  }

  async function handleCsvFileSelect(file: File | null) {
    setError('');
    setSuccess('');
    setCsvRows([]);
    setCsvFileName('');

    if (!file) return;

    const isCsvFile = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');
    if (!isCsvFile) {
      setError('Unsupported file type. Please upload a .csv file');
      return;
    }

    if (file.size > maxCsvBytes) {
      setError('CSV file is too large. Max allowed size is 5MB');
      return;
    }

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      setError('CSV must include a header row and at least one data row');
      return;
    }

    const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/^\uFEFF/, ''));
    const missing = csvRequiredColumns.filter((col) => !header.includes(col));
    if (missing.length > 0) {
      setError(`Missing required columns: ${missing.join(', ')}`);
      return;
    }

    const rows = lines.slice(1).map((line, idx): CsvDraftRow => {
      const cells = splitCsvLine(line);
      const valueOf = (key: string) => {
        const colIndex = header.indexOf(key);
        if (colIndex === -1) return '';
        return (cells[colIndex] || '').trim();
      };

      const normalized = normalizeCsvDate(valueOf('shift_date'));
      const row: CsvDraftRow = {
        rowNumber: idx + 2,
        platform: valueOf('platform'),
        shift_date: normalized.value,
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
      if (normalized.error) {
        row.errors.push(normalized.error);
      }
      return row;
    });

    setCsvFileName(file.name);
    setCsvRows(rows);
  }

  function selectCsvRowScreenshot(index: number, file: File | null) {
    if (!file) {
      setCsvRows((prev) =>
        prev.map((row, rowIndex) =>
          rowIndex === index
            ? { ...row, screenshotFile: null, screenshotFileName: '', uploadError: '', uploaded: false, uploadedShiftId: undefined }
            : row,
        ),
      );
      return;
    }

    if (!supportedImageTypes.includes(file.type)) {
      setCsvRows((prev) =>
        prev.map((row, rowIndex) => (rowIndex === index ? { ...row, uploadError: 'Unsupported screenshot type (JPG, PNG, WEBP)' } : row)),
      );
      return;
    }
    if (file.size > maxScreenshotBytes) {
      setCsvRows((prev) =>
        prev.map((row, rowIndex) => (rowIndex === index ? { ...row, uploadError: 'Screenshot is too large. Max 10MB' } : row)),
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
    const row = csvRows[index];
    if (!row || row.uploaded || !isCsvRowReady(row) || !row.screenshotFile) {
      return;
    }

    setCsvBusy(true);
    setError('');
    setSuccess('');

    try {
      const createPayload = {
        worker_id: workerId,
        platform: row.platform,
        shift_date: row.shift_date,
        hours_worked: Number(row.hours_worked),
        gross_earned: Number(row.gross_earned),
        platform_deductions: Number(row.platform_deductions),
        net_received: Number(row.net_received),
        notes: row.notes || null,
      };

      const { response: createRes, payload: createdShift } = await fetchWithFallback(earningsBases, '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });

      if (!createRes.ok) {
        setCsvRows((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index ? { ...item, uploadError: getErrorMessage(createdShift, 'Could not create shift for row') } : item,
          ),
        );
        return;
      }

      const screenshotForm = new FormData();
      screenshotForm.append('worker_id', workerId);
      screenshotForm.append('file', row.screenshotFile);

      const { response: screenshotRes, payload: screenshotPayload } = await fetchWithFallback(
        earningsBases,
        `/${createdShift.id}/screenshot`,
        {
          method: 'POST',
          body: screenshotForm,
        },
      );

      if (!screenshotRes.ok) {
        await fetchWithFallback(earningsBases, `/${createdShift.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worker_id: workerId }),
        });

        setCsvRows((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index
              ? { ...item, uploadError: getErrorMessage(screenshotPayload, 'Created shift, but screenshot upload failed') }
              : item,
          ),
        );
        return;
      }

      setCsvRows((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, uploaded: true, uploadedShiftId: createdShift.id, uploadError: '' }
            : item,
        ),
      );
      setSuccess('Row uploaded successfully');
      await loadShifts();
    } catch {
      setCsvRows((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index ? { ...item, uploadError: 'Upload failed for this row' } : item,
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

    if (targets.length === 0) {
      setError('Attach screenshots for valid rows before uploading all');
      return;
    }

    for (const target of targets) {
      // eslint-disable-next-line no-await-in-loop
      await uploadCsvRow(target.index);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!screenshotFile) {
      setError('Screenshot is mandatory');
      return;
    }

    if (!supportedImageTypes.includes(screenshotFile.type)) {
      setError('Unsupported screenshot type. Allowed: JPG, PNG, WEBP');
      return;
    }

    if (screenshotFile.size > maxScreenshotBytes) {
      setError('Screenshot is too large. Max allowed size is 10MB');
      return;
    }

    const gross = Number(form.gross_earned);
    const deductions = Number(form.platform_deductions);
    const hours = Number(form.hours_worked);
    const netReceived = Number((gross - deductions).toFixed(2));

    const { response: createRes, payload: createPayload } = await fetchWithFallback(earningsBases, '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_id: workerId,
        platform: form.platform,
        shift_date: form.shift_date,
        hours_worked: hours,
        gross_earned: gross,
        platform_deductions: deductions,
        net_received: netReceived,
        notes: form.notes || null,
      }),
    });

    if (!createRes.ok) {
      setError(getErrorMessage(createPayload, 'Could not create shift'));
      return;
    }

    const shiftId = createPayload?.id;
    const formData = new FormData();
    formData.append('worker_id', workerId);
    formData.append('file', screenshotFile);

    const { response: uploadRes, payload: uploadPayload } = await fetchWithFallback(earningsBases, `/${shiftId}/screenshot`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      setError(getErrorMessage(uploadPayload, 'Shift created but screenshot upload failed'));
      return;
    }

    setSuccess('Earning added successfully');
    setScreenshotFile(null);
    await loadShifts();
  }

  function beginEdit(shift: Shift) {
    setError('');
    setSuccess('');
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

  function cancelEdit() {
    setEditingShiftId(null);
  }

  async function saveEdit() {
    if (!editingShiftId) return;

    setError('');
    setSuccess('');

    const gross = Number(editForm.gross_earned);
    const deductions = Number(editForm.platform_deductions);
    const hours = Number(editForm.hours_worked);
    const netReceived = Number((gross - deductions).toFixed(2));

    if (!Number.isFinite(hours) || hours <= 0) {
      setError('Hours must be greater than 0');
      return;
    }
    if (!Number.isFinite(gross) || gross < 0 || !Number.isFinite(deductions) || deductions < 0) {
      setError('Gross and deductions must be non-negative numbers');
      return;
    }

    const { response, payload } = await fetchWithFallback(earningsBases, `/${editingShiftId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_id: workerId,
        platform: editForm.platform,
        shift_date: editForm.shift_date,
        hours_worked: hours,
        gross_earned: gross,
        platform_deductions: deductions,
        net_received: netReceived,
        notes: editForm.notes || null,
      }),
    });

    if (!response.ok) {
      setError(getErrorMessage(payload, 'Could not update shift. Only pending shifts can be edited.'));
      return;
    }

    setSuccess('Pending earning updated successfully');
    setEditingShiftId(null);
    await loadShifts();
  }

  async function deleteShift(shiftId: string) {
    setError('');
    setSuccess('');

    const { response, payload } = await fetchWithFallback(earningsBases, `/${shiftId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id: workerId }),
    });

    if (!response.ok) {
      setError(getErrorMessage(payload, 'Could not delete shift. Only pending shifts can be deleted.'));
      return;
    }

    if (editingShiftId === shiftId) {
      setEditingShiftId(null);
    }
    setSuccess('Pending earning deleted successfully');
    await loadShifts();
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Add Earning</h2>
        <div className="mb-2 flex gap-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            className={`w-1/2 rounded-md px-3 py-2 text-sm font-semibold ${entryMode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setEntryMode('manual')}
          >
            Manual
          </button>
          <button
            type="button"
            className={`w-1/2 rounded-md px-3 py-2 text-sm font-semibold ${entryMode === 'csv' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setEntryMode('csv')}
          >
            CSV Import
          </button>
        </div>

        {entryMode === 'manual' ? (
          <form onSubmit={submit} className="space-y-3">
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.platform} onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}>
              {platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
            </select>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="date" value={form.shift_date} onChange={(e) => setForm((prev) => ({ ...prev, shift_date: e.target.value }))} />
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" step="0.1" min="0.1" value={form.hours_worked} onChange={(e) => setForm((prev) => ({ ...prev, hours_worked: e.target.value }))} />
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" min="0" value={form.gross_earned} onChange={(e) => setForm((prev) => ({ ...prev, gross_earned: e.target.value }))} />
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" min="0" value={form.platform_deductions} onChange={(e) => setForm((prev) => ({ ...prev, platform_deductions: e.target.value }))} />
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Net Received: PKR {net.toFixed(2)}</div>
            <textarea className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />
            <input type="file" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" accept="image/png,image/jpeg,image/webp" onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)} />
            <button className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" type="submit">Submit</button>
          </form>
        ) : (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-700">Upload CSV, review rows, attach screenshot for each row, then upload.</p>
            <p className="text-xs text-slate-500">
              Required headers: platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, notes
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(e) => {
                void handleCsvFileSelect(e.target.files?.[0] || null);
              }}
            />

            {csvFileName && <p className="text-xs font-medium text-slate-600">Loaded file: {csvFileName}</p>}

            {csvRows.length > 0 && (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-500">
                        <th className="px-2 py-2">Row</th>
                        <th className="px-2 py-2">Platform</th>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Hours</th>
                        <th className="px-2 py-2">Net</th>
                        <th className="px-2 py-2">Screenshot</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {csvRows.map((row, index) => {
                        const canUpload = !row.uploaded && isCsvRowReady(row);
                        return (
                          <tr key={`${row.rowNumber}-${index}`}>
                            <td className="px-2 py-2">{row.rowNumber}</td>
                            <td className="px-2 py-2">{row.platform}</td>
                            <td className="px-2 py-2">{row.shift_date || 'Invalid'}</td>
                            <td className="px-2 py-2">{row.hours_worked}</td>
                            <td className="px-2 py-2">{row.net_received}</td>
                            <td className="px-2 py-2">
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="w-44 rounded border border-slate-300 px-2 py-1 text-[11px]"
                                onChange={(e) => selectCsvRowScreenshot(index, e.target.files?.[0] || null)}
                                disabled={row.uploaded}
                              />
                              {row.screenshotFileName && (
                                <p className="mt-1 truncate text-[11px] text-slate-500">{row.screenshotFileName}</p>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {row.uploaded ? (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">Uploaded</span>
                              ) : row.errors.length > 0 ? (
                                <p className="max-w-[220px] text-[11px] text-red-600">{row.errors.join(', ')}</p>
                              ) : row.uploadError ? (
                                <p className="max-w-[220px] text-[11px] text-red-600">{row.uploadError}</p>
                              ) : !row.screenshotFile ? (
                                <span className="text-[11px] text-amber-600">Attach screenshot</span>
                              ) : (
                                <span className="text-[11px] text-emerald-700">Ready</span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                className="rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                                disabled={!canUpload || csvBusy}
                                onClick={() => void uploadCsvRow(index)}
                              >
                                Upload Row
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => void uploadAllValidCsvRows()}
                  disabled={csvBusy}
                >
                  {csvBusy ? 'Uploading...' : 'Upload All Ready Rows'}
                </button>
              </div>
            )}
          </div>
        )}
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        {success && <p className="text-sm font-medium text-emerald-700">{success}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-slate-900">Recent Earnings</h2>
        {loading ? <p className="text-sm text-slate-600">Loading...</p> : shifts.length === 0 ? <p className="text-sm text-slate-600">No shifts yet.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead><tr className="text-left text-slate-500"><th className="px-2 py-2">Date</th><th className="px-2 py-2">Platform</th><th className="px-2 py-2">Hours</th><th className="px-2 py-2">Net</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.slice(0, 15).map((shift) => (
                  <tr key={shift.id}>
                    <td className="px-2 py-2">{editingShiftId === shift.id ? <input className="w-36 rounded border border-slate-300 px-2 py-1 text-xs" type="date" value={editForm.shift_date} onChange={(e) => setEditForm((prev) => ({ ...prev, shift_date: e.target.value }))} /> : shift.shift_date}</td>
                    <td className="px-2 py-2">{editingShiftId === shift.id ? <select className="rounded border border-slate-300 px-2 py-1 text-xs" value={editForm.platform} onChange={(e) => setEditForm((prev) => ({ ...prev, platform: e.target.value }))}>{platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select> : shift.platform}</td>
                    <td className="px-2 py-2">{editingShiftId === shift.id ? <input className="w-20 rounded border border-slate-300 px-2 py-1 text-xs" type="number" step="0.1" min="0.1" value={editForm.hours_worked} onChange={(e) => setEditForm((prev) => ({ ...prev, hours_worked: e.target.value }))} /> : shift.hours_worked}</td>
                    <td className="px-2 py-2">{editingShiftId === shift.id ? (
                      <div className="flex items-center gap-2">
                        <input className="w-24 rounded border border-slate-300 px-2 py-1 text-xs" type="number" step="0.01" min="0" value={editForm.gross_earned} onChange={(e) => setEditForm((prev) => ({ ...prev, gross_earned: e.target.value }))} />
                        <span className="text-xs text-slate-400">-</span>
                        <input className="w-24 rounded border border-slate-300 px-2 py-1 text-xs" type="number" step="0.01" min="0" value={editForm.platform_deductions} onChange={(e) => setEditForm((prev) => ({ ...prev, platform_deductions: e.target.value }))} />
                        <span className="text-xs font-semibold text-emerald-700">= {Math.max(0, Number(editForm.gross_earned || 0) - Number(editForm.platform_deductions || 0)).toFixed(2)}</span>
                      </div>
                    ) : (
                      `PKR ${Number(shift.net_received).toFixed(2)}`
                    )}</td>
                    <td className="px-2 py-2 capitalize">{shift.verification_status}</td>
                    <td className="px-2 py-2">
                      {shift.verification_status === 'pending' ? (
                        editingShiftId === shift.id ? (
                          <div className="flex gap-2">
                            <button type="button" className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => void saveEdit()}>Save</button>
                            <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700" onClick={cancelEdit}>Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button type="button" className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white" onClick={() => beginEdit(shift)}>Edit</button>
                            <button type="button" className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => void deleteShift(shift.id)}>Delete</button>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">Locked after review</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
