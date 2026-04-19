import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const PORT = 8005;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// GET /analytics/commission-trends — from view
// ---------------------------------------------------------------------------
app.get('/analytics/commission-trends', async (req, res) => {
  const result = await pool.query(`SELECT * FROM analytics.v_commission_trends`);
  res.json(result.rows);
});

// ---------------------------------------------------------------------------
// GET /analytics/income-distribution — from view, optional zone filter
// ---------------------------------------------------------------------------
app.get('/analytics/income-distribution', async (req, res) => {
  const { zone } = req.query;

  if (zone) {
    const result = await pool.query(
      `SELECT * FROM analytics.v_income_distribution WHERE city_zone = $1`,
      [zone],
    );
    return res.json(result.rows);
  }

  const result = await pool.query(`SELECT * FROM analytics.v_income_distribution`);
  res.json(result.rows);
});

// ---------------------------------------------------------------------------
// GET /analytics/vulnerability-flags — from view
// ---------------------------------------------------------------------------
app.get('/analytics/vulnerability-flags', async (req, res) => {
  const result = await pool.query(`SELECT * FROM analytics.v_vulnerability_flags`);
  res.json(result.rows);
});

// ---------------------------------------------------------------------------
// GET /analytics/median/:category/:zone — stored function
// ---------------------------------------------------------------------------
app.get('/analytics/median/:category/:zone', async (req, res) => {
  const { category, zone } = req.params;
  const { month } = req.query; // optional: YYYY-MM-DD

  try {
    const result = await pool.query(
      `SELECT get_city_median($1, $2, $3::DATE) AS median_hourly`,
      [zone, category, month || null],
    );

    res.json({ median_hourly: Number(result.rows[0]?.median_hourly || 0) });
  } catch (err: any) {
    console.error('Median error:', err.message);
    res.json({ median_hourly: 0 });
  }
});

// ---------------------------------------------------------------------------
// GET /analytics/top-complaints — from view
// ---------------------------------------------------------------------------
app.get('/analytics/top-complaints', async (req, res) => {
  const result = await pool.query(`SELECT * FROM analytics.v_top_complaints`);
  res.json(result.rows);
});

// ---------------------------------------------------------------------------
// GET /analytics/verifier-queue — from view
// ---------------------------------------------------------------------------
app.get('/analytics/verifier-queue', async (req, res) => {
  const result = await pool.query(`SELECT * FROM analytics.v_verifier_queue`);
  res.json(result.rows);
});

// ---------------------------------------------------------------------------
// GET /analytics/city-zone-medians — from view
// ---------------------------------------------------------------------------
app.get('/analytics/city-zone-medians', async (req, res) => {
  const { zone, category } = req.query;
  const values: unknown[] = [];
  const where: string[] = [];

  if (zone) {
    values.push(zone);
    where.push(`city_zone = $${values.length}`);
  }
  if (category) {
    values.push(category);
    where.push(`category = $${values.length}`);
  }

  const query = `
    SELECT * FROM analytics.v_city_zone_medians
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY month DESC
  `;

  const result = await pool.query(query, values);
  res.json(result.rows);
});

// ---------------------------------------------------------------------------
// GET /analytics/anomaly-logs — persisted anomaly results
// ---------------------------------------------------------------------------
app.get('/analytics/anomaly-logs', async (req, res) => {
  const { worker_id } = req.query;
  const values: unknown[] = [];
  const where: string[] = [];

  if (worker_id) {
    values.push(worker_id);
    where.push(`worker_id = $${values.length}`);
  }

  const query = `
    SELECT * FROM analytics.anomaly_logs
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY detected_at DESC
    LIMIT 100
  `;

  const result = await pool.query(query, values);
  res.json(result.rows);
});

// ---------------------------------------------------------------------------
// GET /analytics/commission-snapshots — monthly platform snapshots
// ---------------------------------------------------------------------------
app.get('/analytics/commission-snapshots', async (req, res) => {
  const { platform } = req.query;

  if (platform) {
    const result = await pool.query(
      `SELECT * FROM analytics.commission_snapshots
       WHERE platform = $1
       ORDER BY snapshot_month DESC`,
      [platform],
    );
    return res.json(result.rows);
  }

  const result = await pool.query(
    `SELECT * FROM analytics.commission_snapshots ORDER BY snapshot_month DESC`,
  );
  res.json(result.rows);
});

// ---------------------------------------------------------------------------
// GET /analytics/collective-count — count of workers reporting same anomaly
// ---------------------------------------------------------------------------
app.get('/analytics/collective-count', async (req, res) => {
  const { platform, anomaly_type, month } = req.query;

  try {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT worker_id)::int AS count
       FROM analytics.anomaly_logs
       WHERE platform = $1
         AND anomaly_type::TEXT = $2
         AND affected_date LIKE $3`,
      [platform, anomaly_type, month + '%']
    );
    res.json({ count: Number(result.rows[0]?.count || 0) });
  } catch (err: any) {
    console.error('Collective count error:', err.message);
    res.json({ count: 0 });
  }
});

app.listen(PORT, () => {
  console.log(`Analytics Service running on port ${PORT}`);
});
