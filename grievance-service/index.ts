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

// ---------------------------------------------------------------------------
// GET /complaints — list complaints (hides worker_id when anonymous)
// ---------------------------------------------------------------------------
app.get('/complaints', async (req, res) => {
  const { platform, category, status, worker_id } = req.query;
  const values: unknown[] = [];
  const where: string[] = [];

  if (platform) {
    values.push(platform);
    where.push(`c.platform = $${values.length}`);
  }
  if (category) {
    values.push(category);
    where.push(`c.category = $${values.length}::grievance.complaint_category`);
  }
  if (status) {
    values.push(status);
    where.push(`c.status = $${values.length}::grievance.complaint_status`);
  }
  if (worker_id) {
    values.push(worker_id);
    where.push(`c.worker_id = $${values.length}`);
  }

  const query = `
    SELECT
      c.id, c.platform, c.category, c.description, c.is_anonymous,
      c.tags, c.status, c.advocate_id, c.advocate_note, c.cluster_id,
      c.escalated_at, c.resolved_at, c.upvotes, c.created_at, c.updated_at,
      CASE WHEN c.is_anonymous THEN NULL ELSE c.worker_id END AS worker_id,
      CASE WHEN c.is_anonymous THEN 'Anonymous Worker' ELSE u.name END AS worker_name
    FROM grievance.complaints c
    LEFT JOIN auth.users u ON u.id = c.worker_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY c.created_at DESC
  `;

  const result = await pool.query(query, values);
  res.json(result.rows);
});

// ---------------------------------------------------------------------------
// POST /complaints — create a new complaint
// ---------------------------------------------------------------------------
app.post('/complaints', async (req, res) => {
  const { worker_id, platform, category, description, is_anonymous, tags } = req.body;

  if (!worker_id || !platform || !description) {
    return res.status(400).json({ detail: 'worker_id, platform, and description are required' });
  }
  if (description.length < 20) {
    return res.status(400).json({ detail: 'Description must be at least 20 characters' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO grievance.complaints
       (worker_id, platform, category, description, is_anonymous, tags, status)
       VALUES ($1, $2, $3::grievance.complaint_category, $4, $5, $6, 'open')
       RETURNING *`,
      [
        worker_id, platform,
        category || 'other',
        description,
        is_anonymous || false,
        tags || '{}',
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Create complaint error:', err.message);
    res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /complaints/:id/tags — update tags
// ---------------------------------------------------------------------------
app.put('/complaints/:id/tags', async (req, res) => {
  const { id } = req.params;
  const { tags } = req.body;

  if (!Array.isArray(tags)) {
    return res.status(400).json({ detail: 'tags must be an array' });
  }

  const result = await pool.query(
    `UPDATE grievance.complaints SET tags = $1 WHERE id = $2 RETURNING *`,
    [tags, id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Complaint not found' });
  }
  res.json(result.rows[0]);
});

// ---------------------------------------------------------------------------
// PUT /complaints/:id/status — update status (advocate workflow)
// ---------------------------------------------------------------------------
app.put('/complaints/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, advocate_id, advocate_note, cluster_id } = req.body;

  if (!['open', 'escalated', 'resolved', 'rejected'].includes(status)) {
    return res.status(400).json({ detail: 'Invalid status. Must be open, escalated, resolved, or rejected' });
  }

  // The trigger log_complaint_change() auto-creates complaint_history row
  const result = await pool.query(
    `UPDATE grievance.complaints
     SET status = $1::grievance.complaint_status,
         advocate_id = COALESCE($2, advocate_id),
         advocate_note = COALESCE($3, advocate_note),
         cluster_id = COALESCE($4, cluster_id)
     WHERE id = $5
     RETURNING *`,
    [status, advocate_id || null, advocate_note || null, cluster_id || null, id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Complaint not found' });
  }
  res.json(result.rows[0]);
});

// ---------------------------------------------------------------------------
// POST /complaints/:id/upvote — upvote a complaint
// ---------------------------------------------------------------------------
app.post('/complaints/:id/upvote', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ detail: 'user_id is required' });
  }

  try {
    // Trigger sync_complaint_upvotes() increments complaints.upvotes
    await pool.query(
      `INSERT INTO grievance.complaint_upvotes (complaint_id, user_id) VALUES ($1, $2)`,
      [id, user_id],
    );
    res.status(201).json({ status: 'upvoted' });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ detail: 'Already upvoted' });
    }
    res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /complaints/:id/upvote — remove upvote
// ---------------------------------------------------------------------------
app.delete('/complaints/:id/upvote', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ detail: 'user_id is required' });
  }

  // Trigger sync_complaint_upvotes() decrements complaints.upvotes
  const result = await pool.query(
    `DELETE FROM grievance.complaint_upvotes
     WHERE complaint_id = $1 AND user_id = $2
     RETURNING id`,
    [id, user_id],
  );

  if (!result.rows.length) {
    return res.status(404).json({ detail: 'Upvote not found' });
  }
  res.json({ status: 'upvote_removed' });
});

// ---------------------------------------------------------------------------
// GET /complaints/clusters — cluster data from view + table
// ---------------------------------------------------------------------------
app.get('/complaints/clusters', async (req, res) => {
  // Return data from the materialized complaint_clusters table
  const tableResult = await pool.query(
    `SELECT * FROM grievance.complaint_clusters ORDER BY complaint_count DESC`,
  );

  // Also return the dynamic view-based clustering
  const viewResult = await pool.query(
    `SELECT * FROM analytics.v_complaint_clusters`,
  );

  res.json({
    curated_clusters: tableResult.rows,
    dynamic_clusters: viewResult.rows,
  });
});

app.listen(PORT, () => {
  console.log(`Grievance Service running on port ${PORT}`);
});
