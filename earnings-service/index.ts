import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const app = express();
const PORT = 8002;
const uploadDir = path.resolve('earnings-service/uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const uploadScreenshot = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Unsupported screenshot file type. Allowed: JPG, PNG, WEBP'));
      return;
    }
    cb(null, true);
  },
});
const uploadCsv = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const lower = (file.originalname || '').toLowerCase();
    const isCsvMime = file.mimetype.includes('csv') || file.mimetype === 'application/vnd.ms-excel';
    if (!(lower.endsWith('.csv') || isCsvMime)) {
      cb(new Error('Only CSV files are supported for import'));
      return;
    }
    cb(null, true);
  },
});
const supabaseUrl = process.env.SUPABASE_URL || 'https://rboeauycggsgtdhuipah.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseBucket = process.env.SUPABASE_BUCKET || 'gig';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

function validateSupabaseConfig() {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing. Set the service_role key in .env for earnings-service screenshot uploads.');
  }
  if (supabaseServiceRoleKey.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is a publishable key. Use the Supabase service_role key instead.');
  }
}

async function ensureDailyHoursWithinLimit(
  workerId: string,
  shiftDate: string,
  hoursWorked: number,
  excludeShiftId?: string,
) {
  const params: unknown[] = [workerId, shiftDate];
  let query = `
    SELECT COALESCE(SUM(hours_worked), 0)::float8 AS total_hours
    FROM earnings.shifts
    WHERE worker_id = $1
      AND shift_date = $2
      AND deleted_at IS NULL
  `;

  if (excludeShiftId) {
    params.push(excludeShiftId);
    query += ` AND id != $3`;
  }

  const result = await pool.query(query, params);
  const existingHours = Number(result.rows[0]?.total_hours || 0);
  const nextTotal = existingHours + Number(hoursWorked);

  if (nextTotal > 24) {
    throw new Error(`Total hours for ${shiftDate} would be ${nextTotal.toFixed(2)}. Daily limit is 24 hours.`);
  }
}

async function uploadScreenshotToSupabase(
  filePath: string,
  originalFileName: string,
  workerId: string,
  shiftId: string,
  mimeType: string,
) {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing on earnings service');
  }
  if (supabaseServiceRoleKey.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is set to a publishable key. Use the service_role key from Supabase project settings.');
  }

  const safeName = (originalFileName || 'screenshot.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `${workerId}/${shiftId}-${Date.now()}-${safeName}`;
  const encodedPath = objectPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const buffer = fs.readFileSync(filePath);

  const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/${supabaseBucket}/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': mimeType || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const message = await uploadRes.text();
    throw new Error(message || 'Supabase storage upload failed');
  }

  return {
    fileName: safeName,
    fileUrl: `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/${encodedPath}`,
  };
}

function normalizeKey(key: string) {
  return String(key || '').replace(/^\uFEFF/, '').trim().toLowerCase();
}

function pickRowValue(row: Record<string, string>, keys: string[]) {
  const normalized = new Map<string, string>();
  for (const [k, v] of Object.entries(row || {})) {
    normalized.set(normalizeKey(k), typeof v === 'string' ? v.trim() : String(v ?? '').trim());
  }

  for (const key of keys) {
    const value = normalized.get(normalizeKey(key));
    if (value !== undefined && value !== '') return value;
  }
  return '';
}

function normalizePlatform(input: string) {
  const raw = String(input || '').trim();
  const key = raw.toLowerCase();

  const mapping: Record<string, string> = {
    careem: 'Careem',
    bykea: 'Bykea',
    foodpanda: 'foodpanda',
    upwork: 'Upwork',
    other: 'Other',
  };

  return mapping[key] || raw;
}

function parseCsvDate(input: string) {
  const value = String(input || '').trim();
  if (!value) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const compact = value.replace(/\./g, '/').replace(/-/g, '/');
  const parts = compact.split('/').map((p) => p.trim());
  if (parts.length !== 3) return '';

  // YYYY/MM/DD
  if (/^\d{4}$/.test(parts[0])) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD/MM/YYYY or MM/DD/YYYY (best effort)
  if (/^\d{4}$/.test(parts[2])) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    const y = Number(parts[2]);

    let d = a;
    let m = b;
    if (b > 12 && a <= 12) {
      m = a;
      d = b;
    }

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return '';
}

function parseCsvNumber(input: string) {
  const value = String(input || '').replace(/,/g, '').trim();
  if (!value) return NaN;
  return Number(value);
}

// ---------------------------------------------------------------------------
// GET /shifts — list shifts (soft-delete aware)
// ---------------------------------------------------------------------------
app.get('/shifts', async (req, res) => {
  const { worker_id, platform, from, to } = req.query;
  const values: unknown[] = [];
  const where: string[] = ['s.deleted_at IS NULL'];

  if (worker_id) {
    values.push(worker_id);
    where.push(`s.worker_id = $${values.length}`);
  }
  if (platform) {
    values.push(platform);
    where.push(`s.platform = $${values.length}::earnings.platform_name`);
  }
  if (from) {
    values.push(from);
    where.push(`s.shift_date >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    where.push(`s.shift_date <= $${values.length}`);
  }

  const query = `
    SELECT
      s.*, 
      u.name AS worker_name,
      ss.file_url AS screenshot_url
    FROM earnings.shifts s
    JOIN auth.users u ON u.id = s.worker_id
    LEFT JOIN LATERAL (
      SELECT sc.file_url
      FROM earnings.shift_screenshots sc
      WHERE sc.shift_id = s.id
        AND sc.is_primary = TRUE
      ORDER BY sc.uploaded_at DESC
      LIMIT 1
    ) ss ON TRUE
    WHERE ${where.join(' AND ')}
    ORDER BY s.shift_date DESC, s.created_at DESC
  `;

  const result = await pool.query(query, values);
  res.json(result.rows);
});

// ---------------------------------------------------------------------------
// POST /shifts — create a new shift
// ---------------------------------------------------------------------------
app.post('/shifts', async (req, res) => {
  const {
    worker_id, platform, shift_date, hours_worked,
    gross_earned, platform_deductions, net_received, notes,
  } = req.body;

  try {
    await ensureDailyHoursWithinLimit(worker_id, shift_date, Number(hours_worked));

    const result = await pool.query(
      `INSERT INTO earnings.shifts
       (worker_id, platform, shift_date, hours_worked,
        gross_earned, platform_deductions, net_received,
        notes, verification_status)
       VALUES ($1, $2::earnings.platform_name, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [worker_id, platform, shift_date, hours_worked,
        gross_earned, platform_deductions, net_received, notes || null],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Create shift error:', err.message);
    res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /shifts/:id — update a shift
// ---------------------------------------------------------------------------
app.put('/shifts/:id', async (req, res) => {
  const { id } = req.params;
  const { worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, notes } = req.body;

  if (!worker_id) {
    return res.status(400).json({ detail: 'worker_id is required' });
  }

  try {
    await ensureDailyHoursWithinLimit(String(worker_id), String(shift_date), Number(hours_worked), id);
  } catch (err: any) {
    return res.status(400).json({ detail: err.message });
  }

  const result = await pool.query(
    `UPDATE earnings.shifts
     SET platform = $1::earnings.platform_name,
         shift_date = $2,
         hours_worked = $3,
         gross_earned = $4,
         platform_deductions = $5,
         net_received = $6,
         notes = $7
     WHERE id = $8
       AND worker_id = $9
       AND verification_status = 'pending'
       AND deleted_at IS NULL
     RETURNING *`,
    [platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, notes || null, id, worker_id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Shift not found or cannot be edited after review' });
  }
  res.json(result.rows[0]);
});

// ---------------------------------------------------------------------------
// DELETE /shifts/:id — soft-delete via stored function
// ---------------------------------------------------------------------------
app.delete('/shifts/:id', async (req, res) => {
  const { id } = req.params;
  const { worker_id } = req.body;

  if (!worker_id) {
    return res.status(400).json({ detail: 'worker_id is required' });
  }

  const result = await pool.query(
    `UPDATE earnings.shifts
     SET deleted_at = NOW()
     WHERE id = $1
       AND worker_id = $2
       AND verification_status = 'pending'
       AND deleted_at IS NULL
     RETURNING id`,
    [id, worker_id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Shift not found or cannot be deleted after review' });
  }

  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// POST /shifts/import-csv — CSV import with tracking
// ---------------------------------------------------------------------------
app.post('/shifts/import-csv', uploadCsv.single('file'), async (req, res) => {
  const file = req.file;
  const workerId = req.body.worker_id;

  if (!file || !workerId) {
    return res.status(400).json({ detail: 'file and worker_id are required' });
  }

  // Create csv_imports tracking record
  const importResult = await pool.query(
    `INSERT INTO earnings.csv_imports (worker_id, file_name, status)
     VALUES ($1, $2, 'processing')
     RETURNING id`,
    [workerId, file.originalname || file.filename],
  );
  const importId = importResult.rows[0].id;

  const rows: Record<string, string>[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(file.path)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve())
      .on('error', reject);
  });

  let inserted = 0;
  let failed = 0;
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const platform = normalizePlatform(pickRowValue(row, ['platform']));
      const shiftDate = parseCsvDate(pickRowValue(row, ['shift_date', 'date', 'shift date']));
      const hoursWorked = parseCsvNumber(pickRowValue(row, ['hours_worked', 'hours', 'hours worked']));
      const grossEarned = parseCsvNumber(pickRowValue(row, ['gross_earned', 'gross', 'gross earned']));
      const platformDeductions = parseCsvNumber(pickRowValue(row, ['platform_deductions', 'deductions', 'platform deductions']));
      const rawNet = pickRowValue(row, ['net_received', 'net', 'net received']);
      const netReceived = rawNet ? parseCsvNumber(rawNet) : Number((grossEarned - platformDeductions).toFixed(2));

      if (!platform) {
        throw new Error('platform is required');
      }
      if (!shiftDate) {
        throw new Error('shift_date is required and must be a valid date');
      }
      if (!Number.isFinite(hoursWorked) || hoursWorked <= 0 || hoursWorked > 24) {
        throw new Error('hours_worked must be a number between 0 and 24');
      }
      if (!Number.isFinite(grossEarned) || grossEarned < 0) {
        throw new Error('gross_earned must be a non-negative number');
      }
      if (!Number.isFinite(platformDeductions) || platformDeductions < 0) {
        throw new Error('platform_deductions must be a non-negative number');
      }
      if (!Number.isFinite(netReceived) || netReceived < 0) {
        throw new Error('net_received must be a non-negative number');
      }

      await ensureDailyHoursWithinLimit(workerId, shiftDate, hoursWorked);

      await pool.query(
        `INSERT INTO earnings.shifts
         (worker_id, platform, shift_date, hours_worked,
          gross_earned, platform_deductions, net_received,
          is_csv_import, csv_import_id, verification_status)
         VALUES ($1, $2::earnings.platform_name, $3, $4, $5, $6, $7, TRUE, $8, 'pending')`,
        [
          workerId,
          platform,
          shiftDate,
          hoursWorked,
          grossEarned,
          platformDeductions,
          netReceived,
          importId,
        ],
      );
      inserted++;
    } catch (err: any) {
      failed++;
      errors.push({ row: i + 1, error: err.message });
    }
  }

  // Update csv_imports record
  const status = failed === 0 ? 'done' : inserted === 0 ? 'failed' : 'partial';
  await pool.query(
    `UPDATE earnings.csv_imports
     SET rows_total = $1, rows_imported = $2, rows_failed = $3,
         status = $4, error_log = $5
     WHERE id = $6`,
    [rows.length, inserted, failed, status, errors.length > 0 ? JSON.stringify(errors) : null, importId],
  );

  fs.unlinkSync(file.path);
  res.status(201).json({
    import_id: importId,
    rows_total: rows.length,
    inserted_count: inserted,
    failed_count: failed,
    status,
    errors,
  });
});

// ---------------------------------------------------------------------------
// POST /shifts/:id/screenshot — upload to shift_screenshots table
// ---------------------------------------------------------------------------
app.post('/shifts/:id/screenshot', uploadScreenshot.single('file'), async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  const worker_id = req.body.worker_id;
  const screenshot_url = req.body.screenshot_url;

  if (!worker_id) {
    return res.status(400).json({ detail: 'worker_id is required' });
  }

  const extToMime: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
  };

  let fileUrl = '';
  let fileName = '';
  let fileSize: number | null = null;
  let mimeType = 'image/jpeg';

  if (!file && !screenshot_url) {
    return res.status(400).json({ detail: 'file or screenshot_url is required' });
  }

  if (screenshot_url && !file) {
    fileUrl = String(screenshot_url);
    fileName = req.body.file_name || path.basename(fileUrl);
    const urlExt = path.extname(fileName || '').toLowerCase();
    mimeType = extToMime[urlExt] || 'image/jpeg';
  }

  if (file) {
    fileName = file.originalname || file.filename;
    fileSize = file.size;

    const ext = path.extname(file.originalname || '').toLowerCase();
    mimeType = extToMime[ext] || 'image/jpeg';

    try {
      const uploaded = await uploadScreenshotToSupabase(file.path, fileName, String(worker_id), id, mimeType);
      fileUrl = uploaded.fileUrl;
      fileName = uploaded.fileName;
      fs.unlinkSync(file.path);
    } catch (uploadErr: any) {
      console.error('Supabase screenshot upload error:', uploadErr.message);
      return res.status(502).json({
        detail: `Screenshot upload failed on earnings service: ${uploadErr.message}`,
      });
    }
  }

  try {
    await pool.query(
      `UPDATE earnings.shift_screenshots
       SET is_primary = FALSE
       WHERE shift_id = $1 AND is_primary = TRUE`,
      [id],
    );

    // Insert into shift_screenshots (trigger sync_has_screenshot updates the shift)
    const result = await pool.query(
      `INSERT INTO earnings.shift_screenshots
       (shift_id, worker_id, file_url, file_name, file_size_bytes, mime_type, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6::TEXT, TRUE)
       RETURNING *`,
      [id, worker_id, fileUrl, fileName, fileSize, mimeType],
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Screenshot upload error:', err.message);
    res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /verifier/queue — uses the v_verifier_queue view
// ---------------------------------------------------------------------------
app.get('/verifier/queue', async (req, res) => {
  const result = await pool.query(`SELECT * FROM analytics.v_verifier_queue`);
  res.json(result.rows);
});

// ---------------------------------------------------------------------------
// PUT /verifier/:id/decision — verify / flag / reject a shift
// ---------------------------------------------------------------------------
app.put('/verifier/:id/decision', async (req, res) => {
  const { id } = req.params;
  const { status, verifier_id, verifier_note } = req.body;

  if (!['verified', 'flagged', 'unverifiable'].includes(status)) {
    return res.status(400).json({ detail: 'Invalid status. Must be verified, flagged, or unverifiable' });
  }
  if (!verifier_id) {
    return res.status(400).json({ detail: 'verifier_id is required' });
  }

  // The trigger log_verification_change() auto-creates verification_history row
  const result = await pool.query(
    `UPDATE earnings.shifts
     SET verification_status = $1::earnings.verify_status,
         verifier_id = $2,
         verifier_note = $3
     WHERE id = $4 AND deleted_at IS NULL
     RETURNING *`,
    [status, verifier_id, verifier_note || null, id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Shift not found' });
  }
  res.json(result.rows[0]);
});

// ---------------------------------------------------------------------------
// GET /shifts/income-certificate — calls stored function
// ---------------------------------------------------------------------------
app.get('/shifts/income-certificate', async (req, res) => {
  const { worker_id, from_date, to_date } = req.query;

  if (!worker_id || !from_date || !to_date) {
    return res.status(400).json({ detail: 'worker_id, from_date, to_date are required' });
  }

  const result = await pool.query(
    `SELECT * FROM get_income_certificate_data($1::UUID, $2::DATE, $3::DATE)`,
    [worker_id, from_date, to_date],
  );

  res.json({
    worker_id,
    period: { from: from_date, to: to_date },
    platforms: result.rows,
  });
});

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ detail: 'Uploaded file is too large' });
    }
    return res.status(400).json({ detail: err.message });
  }

  if (err && err.message && err.message.includes('Unsupported screenshot file type')) {
    return res.status(400).json({ detail: err.message });
  }
  if (err && err.message && err.message.includes('Only CSV files are supported')) {
    return res.status(400).json({ detail: err.message });
  }

  return next(err);
});

app.listen(PORT, () => {
  try {
    validateSupabaseConfig();
  } catch (configErr: any) {
    console.error(`❌ Earnings Service config error: ${configErr.message}`);
    process.exit(1);
  }
  console.log(`Earnings Service running on port ${PORT}`);
});
