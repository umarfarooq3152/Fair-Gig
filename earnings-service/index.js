import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { jwtVerify } from 'jose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = 8002;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required (same secret as auth-service)');
  process.exit(1);
}
const JWT_KEY = new TextEncoder().encode(JWT_SECRET);

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'image/jpeg' || file.mimetype === 'image/png';
    cb(ok ? null : new Error('Only image/jpeg and image/png are allowed'), ok);
  },
});

const csvUpload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

async function getAuth(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    const err = new Error('Missing Authorization bearer token');
    err.statusCode = 401;
    throw err;
  }
  try {
    const { payload } = await jwtVerify(token, JWT_KEY);
    const sub = String(payload.sub || '');
    const role = String(payload.role || '');
    if (!sub || !role) {
      const err = new Error('Invalid token payload');
      err.statusCode = 401;
      throw err;
    }
    return { sub, role };
  } catch (e) {
    const err = new Error('Invalid or expired token');
    err.statusCode = 401;
    throw err;
  }
}

async function requireRole(req, roles) {
  const auth = await getAuth(req);
  if (!roles.includes(auth.role)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return auth;
}

function handleRouteError(res, err) {
  const code = err.statusCode || 500;
  if (code === 500) console.error(err);
  res.status(code).json({ detail: err.message || 'Server error' });
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'earnings-service', port: PORT });
});

app.get('/shifts', async (req, res) => {
  try {
    const auth = await requireRole(req, ['worker']);
    const { worker_id, platform, from, to } = req.query;
    const wid = worker_id || auth.sub;
    if (worker_id && worker_id !== auth.sub) {
      return res.status(403).json({ detail: 'worker_id must match authenticated user' });
    }
    const values = [wid];
    const where = [`worker_id = $1`];

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
      WHERE ${where.join(' AND ')}
      ORDER BY shift_date DESC, created_at DESC
    `;
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    handleRouteError(res, err);
  }
});

function validateShiftBody(body) {
  const { worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received } = body;
  if (!worker_id || !platform || !shift_date) {
    return 'worker_id, platform, and shift_date are required';
  }
  const nums = [hours_worked, gross_earned, platform_deductions, net_received];
  if (nums.some((n) => n === undefined || n === null || Number.isNaN(Number(n)))) {
    return 'hours_worked, gross_earned, platform_deductions, and net_received are required numbers';
  }
  if (nums.some((n) => Number(n) < 0)) {
    return 'numeric fields must be >= 0';
  }
  if (String(platform).trim() === '') {
    return 'platform must not be empty';
  }
  const d = Date.parse(String(shift_date));
  if (Number.isNaN(d)) {
    return 'shift_date must be a valid date';
  }
  return null;
}

app.post('/shifts', async (req, res) => {
  try {
    const auth = await requireRole(req, ['worker']);
    const msg = validateShiftBody(req.body);
    if (msg) return res.status(400).json({ detail: msg });
    const { worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received } = req.body;
    if (worker_id !== auth.sub) {
      return res.status(403).json({ detail: 'worker_id must match authenticated user' });
    }
    const u = await pool.query('SELECT id FROM auth.users WHERE id = $1', [worker_id]);
    if (!u.rows.length) {
      return res.status(400).json({ detail: 'worker_id does not exist' });
    }
    const result = await pool.query(
      `INSERT INTO earnings.shifts
      (worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, verification_status)
      VALUES ($1, $2::earnings.platform_name, $3, $4, $5, $6, $7, 'pending')
      RETURNING *`,
      [worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleRouteError(res, err);
  }
});

app.put('/shifts/:id', async (req, res) => {
  try {
    const auth = await requireRole(req, ['worker']);
    const { id } = req.params;
    const own = await pool.query('SELECT worker_id FROM earnings.shifts WHERE id = $1', [id]);
    if (!own.rows.length) {
      return res.status(404).json({ detail: 'Shift not found' });
    }
    if (own.rows[0].worker_id !== auth.sub) {
      return res.status(403).json({ detail: 'Cannot update another worker shift' });
    }
    const { platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received } = req.body;
    const result = await pool.query(
      `UPDATE earnings.shifts
       SET platform = $1::earnings.platform_name,
           shift_date = $2,
           hours_worked = $3,
           gross_earned = $4,
           platform_deductions = $5,
           net_received = $6
       WHERE id = $7
       RETURNING *`,
      [platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, id],
    );
    res.json(result.rows[0]);
  } catch (err) {
    handleRouteError(res, err);
  }
});

app.delete('/shifts/:id', async (req, res) => {
  try {
    const auth = await requireRole(req, ['worker']);
    const { id } = req.params;
    const own = await pool.query('SELECT worker_id FROM earnings.shifts WHERE id = $1', [id]);
    if (!own.rows.length) {
      return res.status(404).json({ detail: 'Shift not found' });
    }
    if (own.rows[0].worker_id !== auth.sub) {
      return res.status(403).json({ detail: 'Cannot delete another worker shift' });
    }
    await pool.query('DELETE FROM earnings.shifts WHERE id = $1', [id]);
    res.json({ status: 'ok' });
  } catch (err) {
    handleRouteError(res, err);
  }
});

app.post('/shifts/import-csv', csvUpload.single('file'), async (req, res) => {
  try {
    const auth = await requireRole(req, ['worker']);
    const file = req.file;
    const workerId = req.body.worker_id;
    if (!file || !workerId) {
      return res.status(400).json({ detail: 'file and worker_id are required' });
    }
    if (workerId !== auth.sub) {
      return res.status(403).json({ detail: 'worker_id must match authenticated user' });
    }

    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(file.path)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve())
        .on('error', reject);
    });

    let imported = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const platform = row.platform;
        const shift_date = row.shift_date;
        const hours_worked = Number(row.hours_worked);
        const gross_earned = Number(row.gross_earned);
        const platform_deductions = Number(row.platform_deductions);
        const net_received = Number(row.net_received);
        if (!platform || !shift_date || [hours_worked, gross_earned, platform_deductions, net_received].some((n) => Number.isNaN(n))) {
          errors.push({ row: i + 1, error: 'missing or invalid fields' });
          continue;
        }
        await pool.query(
          `INSERT INTO earnings.shifts
          (worker_id, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received, verification_status)
          VALUES ($1, $2::earnings.platform_name, $3, $4, $5, $6, $7, 'pending')`,
          [workerId, platform, shift_date, hours_worked, gross_earned, platform_deductions, net_received],
        );
        imported += 1;
      } catch (e) {
        errors.push({ row: i + 1, error: String(e.message || e) });
      }
    }

    fs.unlinkSync(file.path);
    const failed = errors.length;
    res.status(201).json({
      imported,
      failed,
      errors: errors.slice(0, 50),
    });
  } catch (err) {
    handleRouteError(res, err);
  }
});

app.post('/shifts/:id/screenshot', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ detail: err.message || 'Upload rejected' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const auth = await requireRole(req, ['worker']);
    const { id } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ detail: 'file is required (JPEG or PNG, max 5MB)' });
    }

    const own = await pool.query('SELECT worker_id FROM earnings.shifts WHERE id = $1', [id]);
    if (!own.rows.length) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ detail: 'Shift not found' });
    }
    if (own.rows[0].worker_id !== auth.sub) {
      fs.unlinkSync(file.path);
      return res.status(403).json({ detail: 'Cannot upload for another worker shift' });
    }

    const relativeUrl = `/uploads/${path.basename(file.path)}`;
    const result = await pool.query(
      `UPDATE earnings.shifts
       SET screenshot_url = $1
       WHERE id = $2
       RETURNING *`,
      [relativeUrl, id],
    );

    res.json(result.rows[0]);
  } catch (err) {
    handleRouteError(res, err);
  }
});

app.get('/verifier/queue', async (req, res) => {
  try {
    await requireRole(req, ['verifier']);
    const result = await pool.query(
      `SELECT s.*, u.name as worker_name
       FROM earnings.shifts s
       JOIN auth.users u ON u.id = s.worker_id
       WHERE s.verification_status = 'pending'
         AND s.screenshot_url IS NOT NULL
       ORDER BY s.created_at ASC`,
    );
    res.json(result.rows);
  } catch (err) {
    handleRouteError(res, err);
  }
});

app.put('/verifier/:id/decision', async (req, res) => {
  try {
    const auth = await requireRole(req, ['verifier']);
    const { id } = req.params;
    const { status } = req.body;
    if (!['verified', 'flagged', 'unverifiable'].includes(status)) {
      return res.status(400).json({ detail: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE earnings.shifts
       SET verification_status = $1,
           verifier_id = $2
       WHERE id = $3
       RETURNING *`,
      [status, auth.sub, id],
    );

    if (!result.rows.length) {
      return res.status(404).json({ detail: 'Shift not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    handleRouteError(res, err);
  }
});

app.listen(PORT, () => {
  console.log(`Earnings Service running on port ${PORT}`);
});
