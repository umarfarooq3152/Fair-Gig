import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const PORT = 8002;
const uploadDir = path.resolve('earnings-service/uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

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
    SELECT s.*, u.name AS worker_name
    FROM earnings.shifts s
    JOIN auth.users u ON u.id = s.worker_id
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
  const { platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, notes } = req.body;

  const result = await pool.query(
    `UPDATE earnings.shifts
     SET platform = $1::earnings.platform_name,
         shift_date = $2,
         hours_worked = $3,
         gross_earned = $4,
         platform_deductions = $5,
         net_received = $6,
         notes = $7
     WHERE id = $8 AND deleted_at IS NULL
     RETURNING *`,
    [platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, notes || null, id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Shift not found' });
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
    // Fallback: soft-delete without ownership check
    await pool.query(
      `UPDATE earnings.shifts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  } else {
    await pool.query(
      `SELECT soft_delete_shift($1::UUID, $2::UUID)`,
      [id, worker_id],
    );
  }

  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// POST /shifts/import-csv — CSV import with tracking
// ---------------------------------------------------------------------------
app.post('/shifts/import-csv', upload.single('file'), async (req, res) => {
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
      await pool.query(
        `INSERT INTO earnings.shifts
         (worker_id, platform, shift_date, hours_worked,
          gross_earned, platform_deductions, net_received,
          is_csv_import, csv_import_id, verification_status)
         VALUES ($1, $2::earnings.platform_name, $3, $4, $5, $6, $7, TRUE, $8, 'pending')`,
        [
          workerId,
          row.platform,
          row.shift_date,
          Number(row.hours_worked),
          Number(row.gross_earned),
          Number(row.platform_deductions),
          Number(row.net_received),
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
  });
});

// ---------------------------------------------------------------------------
// POST /shifts/:id/screenshot — upload to shift_screenshots table
// ---------------------------------------------------------------------------
app.post('/shifts/:id/screenshot', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  const worker_id = req.body.worker_id;

  if (!file) {
    return res.status(400).json({ detail: 'file is required' });
  }

  const relativeUrl = `/uploads/${path.basename(file.path)}`;

  // Determine mime_type
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
  };
  const mimeType = mimeMap[ext] || 'image/jpeg';

  try {
    // Insert into shift_screenshots (trigger sync_has_screenshot updates the shift)
    const result = await pool.query(
      `INSERT INTO earnings.shift_screenshots
       (shift_id, worker_id, file_url, file_name, file_size_bytes, mime_type, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6::TEXT, TRUE)
       RETURNING *`,
      [id, worker_id || null, relativeUrl, file.originalname || file.filename, file.size, mimeType],
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

app.listen(PORT, () => {
  console.log(`Earnings Service running on port ${PORT}`);
});
