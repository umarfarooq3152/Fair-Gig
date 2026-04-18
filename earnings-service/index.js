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

app.get('/shifts', async (req, res) => {
  const { worker_id, platform, from, to } = req.query;
  const values = [];
  const where = [];

  if (worker_id) {
    values.push(worker_id);
    where.push(`worker_id = $${values.length}`);
  }
  if (platform) {
    values.push(platform);
    where.push(`platform = $${values.length}`);
  }
  if (from) {
    values.push(from);
    where.push(`shift_date >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    where.push(`shift_date <= $${values.length}`);
  }

  const query = `
    SELECT *
    FROM earnings.shifts
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY shift_date DESC, created_at DESC
  `;

  const result = await pool.query(query, values);
  res.json(result.rows);
});

app.post('/shifts', async (req, res) => {
  const { worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received } = req.body;
  const result = await pool.query(
    `INSERT INTO earnings.shifts
    (worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, verification_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
    RETURNING *`,
    [worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received],
  );
  res.status(201).json(result.rows[0]);
});

app.put('/shifts/:id', async (req, res) => {
  const { id } = req.params;
  const { platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received } = req.body;
  const result = await pool.query(
    `UPDATE earnings.shifts
     SET platform = $1,
         shift_date = $2,
         hours_worked = $3,
         gross_earned = $4,
         platform_deductions = $5,
         net_received = $6
     WHERE id = $7
     RETURNING *`,
    [platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Shift not found' });
  }

  res.json(result.rows[0]);
});

app.delete('/shifts/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM earnings.shifts WHERE id = $1', [id]);
  res.json({ status: 'ok' });
});

app.post('/shifts/import-csv', upload.single('file'), async (req, res) => {
  const file = req.file;
  const workerId = req.body.worker_id;

  if (!file || !workerId) {
    return res.status(400).json({ detail: 'file and worker_id are required' });
  }

  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(file.path)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve())
      .on('error', reject);
  });

  let inserted = 0;
  for (const row of rows) {
    await pool.query(
      `INSERT INTO earnings.shifts
      (worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, verification_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
      [
        workerId,
        row.platform,
        row.shift_date,
        Number(row.hours_worked),
        Number(row.gross_earned),
        Number(row.platform_deductions),
        Number(row.net_received),
      ],
    );
    inserted += 1;
  }

  fs.unlinkSync(file.path);
  res.status(201).json({ inserted_count: inserted });
});

app.post('/shifts/:id/screenshot', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  if (!file) {
    return res.status(400).json({ detail: 'file is required' });
  }

  const relativeUrl = `/uploads/${path.basename(file.path)}`;
  const result = await pool.query(
    `UPDATE earnings.shifts
     SET screenshot_url = $1
     WHERE id = $2
     RETURNING *`,
    [relativeUrl, id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Shift not found' });
  }

  res.json(result.rows[0]);
});

app.get('/verifier/queue', async (_req, res) => {
  const result = await pool.query(
    `SELECT s.*, u.name as worker_name
     FROM earnings.shifts s
     JOIN auth.users u ON u.id = s.worker_id
     WHERE s.verification_status = 'pending'
       AND s.screenshot_url IS NOT NULL
     ORDER BY s.created_at ASC`,
  );
  res.json(result.rows);
});

app.put('/verifier/:id/decision', async (req, res) => {
  const { id } = req.params;
  const { status, verifier_id } = req.body;
  if (!['verified', 'flagged', 'unverifiable'].includes(status)) {
    return res.status(400).json({ detail: 'Invalid status' });
  }

  const result = await pool.query(
    `UPDATE earnings.shifts
     SET verification_status = $1,
         verifier_id = $2
     WHERE id = $3
     RETURNING *`,
    [status, verifier_id ?? null, id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Shift not found' });
  }

  res.json(result.rows[0]);
});

app.listen(PORT, () => {
  console.log(`Earnings Service running on port ${PORT}`);
});
