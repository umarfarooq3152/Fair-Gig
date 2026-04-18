import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const PORT = 8004;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

app.use(cors());
app.use(express.json());

app.get('/complaints', async (req, res) => {
  const { platform, category, status, worker_id } = req.query;
  const values = [];
  const where = [];

  if (platform) {
    values.push(platform);
    where.push(`platform = $${values.length}`);
  }
  if (category) {
    values.push(category);
    where.push(`category = $${values.length}`);
  }
  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }
  if (worker_id) {
    values.push(worker_id);
    where.push(`worker_id = $${values.length}`);
  }

  const query = `
    SELECT *
    FROM grievance.complaints
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
  `;
  const result = await pool.query(query, values);
  res.json(result.rows);
});

app.post('/complaints', async (req, res) => {
  const { worker_id, platform, category, description } = req.body;
  const result = await pool.query(
    `INSERT INTO grievance.complaints (worker_id, platform, category, description, status)
     VALUES ($1, $2, $3, $4, 'open')
     RETURNING *`,
    [worker_id, platform, category, description],
  );
  res.status(201).json(result.rows[0]);
});

app.put('/complaints/:id/tags', async (req, res) => {
  const { id } = req.params;
  const { tags } = req.body;

  if (!Array.isArray(tags)) {
    return res.status(400).json({ detail: 'tags must be an array' });
  }

  const result = await pool.query(
    `UPDATE grievance.complaints
     SET tags = $1
     WHERE id = $2
     RETURNING *`,
    [tags, id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Complaint not found' });
  }

  res.json(result.rows[0]);
});

app.put('/complaints/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, advocate_id } = req.body;

  if (!['open', 'escalated', 'resolved'].includes(status)) {
    return res.status(400).json({ detail: 'Invalid status' });
  }

  const result = await pool.query(
    `UPDATE grievance.complaints
     SET status = $1,
         advocate_id = $2
     WHERE id = $3
     RETURNING *`,
    [status, advocate_id ?? null, id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Complaint not found' });
  }

  res.json(result.rows[0]);
});

app.get('/complaints/clusters', async (_req, res) => {
  const result = await pool.query(`
    SELECT
      COALESCE(tags[1], 'untagged') AS primary_tag,
      platform,
      COUNT(*)::int AS complaint_count,
      STRING_AGG(id::text, ',') AS complaint_ids
    FROM grievance.complaints
    GROUP BY COALESCE(tags[1], 'untagged'), platform
    ORDER BY complaint_count DESC
  `);

  res.json({ clusters: result.rows });
});

app.listen(PORT, () => {
  console.log(`Grievance Service running on port ${PORT}`);
});
