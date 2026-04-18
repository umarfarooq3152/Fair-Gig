import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { jwtVerify } from 'jose';
import { EventEmitter } from 'events';

dotenv.config();

const app = express();
const PORT = 8004;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_fairgig_softec_2026';
const JWT_SECRET_UINT8 = new TextEncoder().encode(JWT_SECRET);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

app.use(cors());
app.use(express.json());

const grievanceEvents = new EventEmitter();

grievanceEvents.on('complaint.categorized', (payload) => {
  // Lightweight hook for future analytics service integration.
  console.log('[grievance-event] complaint.categorized', payload);
});

grievanceEvents.on('complaint.status_changed', (payload) => {
  // Lightweight hook for future analytics service integration.
  console.log('[grievance-event] complaint.status_changed', payload);
});

type AuthInfo = {
  userId: string;
  role: string;
};

async function resolveAuth(req: express.Request): Promise<AuthInfo> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    throw new Error('Missing bearer token');
  }

  const { payload } = await jwtVerify(token, JWT_SECRET_UINT8);
  const userId = String(payload.sub || '');
  const role = String(payload.role || '');

  if (!userId || !role) {
    throw new Error('Invalid token payload');
  }

  return { userId, role };
}

async function requireRole(req: express.Request, allowed: string[]) {
  const auth = await resolveAuth(req);
  if (!allowed.includes(auth.role)) {
    throw new Error('Forbidden');
  }
  return auth;
}

function cleanTags(tags: unknown) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => String(tag || '').trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 20);
}

function parsePositiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function encodeCursor(row: { created_at: string; id: string }) {
  return Buffer.from(`${row.created_at}|${row.id}`).toString('base64');
}

function decodeCursor(value: unknown): { createdAt: string; id: string } | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(String(value), 'base64').toString('utf8');
    const [createdAt, id] = decoded.split('|');
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST /api/complaints — Worker complaint create with anti-spam (3/hour)
// ---------------------------------------------------------------------------
app.post('/api/complaints', async (req, res) => {
  try {
    const auth = await requireRole(req, ['worker']);
    const { platform, category, description, is_anonymous, tags } = req.body;

    if (!platform || !description) {
      return res.status(400).json({ detail: 'platform and description are required' });
    }

    if (String(description).trim().length < 20) {
      return res.status(400).json({ detail: 'description must be at least 20 characters' });
    }

    const spamCheck = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM grievance.complaints
       WHERE worker_id = $1 AND created_at >= NOW() - INTERVAL '1 hour'`,
      [auth.userId],
    );

    if ((spamCheck.rows[0]?.count || 0) >= 3) {
      return res.status(429).json({ detail: 'Rate limit exceeded: max 3 complaints per hour' });
    }

    const result = await pool.query(
      `INSERT INTO grievance.complaints
       (worker_id, platform, category, description, is_anonymous, tags, status)
       VALUES ($1, $2, $3::grievance.complaint_category, $4, $5, $6, 'open')
       RETURNING id, platform, category, description, is_anonymous, tags, status, created_at`,
      [
        auth.userId,
        platform,
        category || 'other',
        String(description).trim(),
        Boolean(is_anonymous),
        cleanTags(tags),
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Only workers can submit complaints' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('POST /api/complaints error:', err.message);
    return res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/complaints/mine — Worker-only personal complaint history
// ---------------------------------------------------------------------------
app.get('/api/complaints/mine', async (req, res) => {
  try {
    const auth = await requireRole(req, ['worker']);
    const { status } = req.query;
    const values: unknown[] = [auth.userId];
    const where: string[] = ['worker_id = $1'];

    if (status) {
      values.push(status);
      where.push(`status = $${values.length}::grievance.complaint_status`);
    }

    const result = await pool.query(
      `SELECT
         id,
         worker_id,
         platform,
         category,
         description,
         is_anonymous,
         tags,
         status,
         cluster_id,
         upvotes,
         created_at,
         updated_at
       FROM grievance.complaints
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC`,
      values,
    );

    res.json(result.rows);
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Worker access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('GET /api/complaints/mine error:', err.message);
    return res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/complaints/public — Anonymous bulletin board (no PII/author IDs)
// ---------------------------------------------------------------------------
app.get('/api/complaints/public', async (req, res) => {
  try {
    const { platform, category, status } = req.query;
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

    const result = await pool.query(
      `SELECT
         c.id,
         c.platform,
         c.category,
         c.description,
         c.is_anonymous,
         c.tags,
         c.status,
         c.cluster_id,
         c.upvotes,
         c.created_at,
         c.updated_at
       FROM grievance.complaints c
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY c.created_at DESC`,
      values,
    );

    res.json(result.rows);
  } catch (err: any) {
    console.error('GET /api/complaints/public error:', err.message);
    res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/complaints/advocate — Full complaint view for advocates
// ---------------------------------------------------------------------------
app.get('/api/complaints/advocate', async (req, res) => {
  try {
    await requireRole(req, ['advocate']);

    const { platform, category, status, cluster_id } = req.query;
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
    if (cluster_id) {
      values.push(cluster_id);
      where.push(`c.cluster_id = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT
         c.id,
         c.worker_id,
         u.name AS worker_name,
         u.email AS worker_email,
         c.platform,
         c.category,
         c.description,
         c.is_anonymous,
         c.tags,
         c.status,
         c.advocate_id,
         c.advocate_note,
         c.cluster_id,
         c.escalated_at,
         c.resolved_at,
         c.upvotes,
         c.created_at,
         c.updated_at
       FROM grievance.complaints c
       JOIN auth.users u ON u.id = c.worker_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY c.created_at DESC`,
      values,
    );

    res.json(result.rows);
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('GET /api/complaints/advocate error:', err.message);
    res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/complaints/advocate/feed — Cursor pagination for large mod queue
// ---------------------------------------------------------------------------
app.get('/api/complaints/advocate/feed', async (req, res) => {
  try {
    await requireRole(req, ['advocate']);

    const { platform, category, status, cluster_id, cursor } = req.query;
    const limit = parsePositiveInt(req.query.limit, 50, 100);
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
    if (cluster_id) {
      values.push(cluster_id);
      where.push(`c.cluster_id = $${values.length}`);
    }

    const decoded = decodeCursor(cursor);
    if (decoded) {
      values.push(decoded.createdAt);
      const createdParam = values.length;
      values.push(decoded.id);
      const idParam = values.length;
      where.push(`(c.created_at < $${createdParam}::timestamptz OR (c.created_at = $${createdParam}::timestamptz AND c.id < $${idParam}::uuid))`);
    }

    values.push(limit + 1);

    const result = await pool.query(
      `SELECT
         c.id,
         c.worker_id,
         u.name AS worker_name,
         u.email AS worker_email,
         c.platform,
         c.category,
         c.description,
         c.is_anonymous,
         c.tags,
         c.status,
         c.advocate_id,
         c.advocate_note,
         c.cluster_id,
         c.escalated_at,
         c.resolved_at,
         c.upvotes,
         c.created_at,
         c.updated_at
       FROM grievance.complaints c
       JOIN auth.users u ON u.id = c.worker_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT $${values.length}`,
      values,
    );

    const rows = result.rows;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];

    res.json({
      items,
      has_more: hasMore,
      next_cursor: hasMore && last ? encodeCursor(last) : null,
    });
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('GET /api/complaints/advocate/feed error:', err.message);
    return res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/complaints/advocate/new-count — Count new items since timestamp
// ---------------------------------------------------------------------------
app.get('/api/complaints/advocate/new-count', async (req, res) => {
  try {
    await requireRole(req, ['advocate']);

    const { since, platform, category, status } = req.query;
    const values: unknown[] = [];
    const where: string[] = [];

    if (since) {
      values.push(String(since));
      where.push(`c.created_at > $${values.length}::timestamptz`);
    }
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

    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM grievance.complaints c
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
      values,
    );

    res.json({ count: result.rows[0]?.count || 0 });
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('GET /api/complaints/advocate/new-count error:', err.message);
    return res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/complaints/alerts/spikes — Platform/category spikes in last X hours
// ---------------------------------------------------------------------------
app.get('/api/complaints/alerts/spikes', async (req, res) => {
  try {
    await requireRole(req, ['advocate']);

    const windowHours = parsePositiveInt(req.query.window_hours, 3, 48);
    const minCount = parsePositiveInt(req.query.min_count, 5, 500);

    const result = await pool.query(
      `SELECT
         platform,
         category,
         COUNT(*)::int AS count,
         MIN(created_at) AS first_seen_at,
         MAX(created_at) AS latest_seen_at
       FROM grievance.complaints
       WHERE created_at >= NOW() - ($1::text || ' hours')::interval
       GROUP BY platform, category
       HAVING COUNT(*) >= $2
       ORDER BY COUNT(*) DESC, MAX(created_at) DESC
       LIMIT 25`,
      [windowHours, minCount],
    );

    res.json({ window_hours: windowHours, min_count: minCount, items: result.rows });
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('GET /api/complaints/alerts/spikes error:', err.message);
    return res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/complaints/clusters — Cluster list for add-to-existing workflow
// ---------------------------------------------------------------------------
app.get('/api/complaints/clusters', async (req, res) => {
  try {
    await requireRole(req, ['advocate']);
    const limit = parsePositiveInt(req.query.limit, 50, 200);
    const result = await pool.query(
      `SELECT id, name, platform, primary_tag, complaint_count, created_at
       FROM grievance.complaint_clusters
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    res.json(result.rows);
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('GET /api/complaints/clusters error:', err.message);
    return res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/complaints/:id/moderate — Advocate moderation updates
// ---------------------------------------------------------------------------
app.put('/api/complaints/:id/moderate', async (req, res) => {
  try {
    const auth = await requireRole(req, ['advocate']);
    const { id } = req.params;
    const { tags, category, description, advocate_note } = req.body;

    const current = await pool.query(
      `SELECT id, category, status FROM grievance.complaints WHERE id = $1`,
      [id],
    );

    if (!current.rows.length) {
      return res.status(404).json({ detail: 'Complaint not found' });
    }

    const nextTags = tags === undefined ? null : cleanTags(tags);
    const nextDescription = description === undefined ? null : String(description).trim();

    const result = await pool.query(
      `UPDATE grievance.complaints
       SET tags = COALESCE($1, tags),
           category = COALESCE($2::grievance.complaint_category, category),
           description = COALESCE($3, description),
           advocate_note = COALESCE($4, advocate_note),
           advocate_id = $5
       WHERE id = $6
       RETURNING *`,
      [nextTags, category || null, nextDescription || null, advocate_note || null, auth.userId, id],
    );

    if (category && category !== current.rows[0].category) {
      grievanceEvents.emit('complaint.categorized', {
        complaint_id: id,
        old_category: current.rows[0].category,
        new_category: category,
        advocate_id: auth.userId,
        changed_at: new Date().toISOString(),
      });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('PUT /api/complaints/:id/moderate error:', err.message);
    res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/complaints/cluster — Cluster complaint IDs under one cluster record
// ---------------------------------------------------------------------------
app.post('/api/complaints/cluster', async (req, res) => {
  const client = await pool.connect();
  try {
    const auth = await requireRole(req, ['advocate']);
    const { complaint_ids, name, platform, primary_tag } = req.body;

    if (!Array.isArray(complaint_ids) || complaint_ids.length < 2) {
      return res.status(400).json({ detail: 'complaint_ids must include at least 2 complaints' });
    }

    await client.query('BEGIN');

    const priorClustersResult = await client.query(
      `SELECT DISTINCT cluster_id FROM grievance.complaints
       WHERE id = ANY($1::uuid[]) AND cluster_id IS NOT NULL`,
      [complaint_ids],
    );
    const priorClusterIds = priorClustersResult.rows.map((row) => row.cluster_id as string);

    const clusterResult = await client.query(
      `INSERT INTO grievance.complaint_clusters (name, platform, primary_tag, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name || `Cluster ${Date.now()}`, platform || null, primary_tag || 'untagged', auth.userId],
    );

    const cluster = clusterResult.rows[0];

    const updateResult = await client.query(
      `UPDATE grievance.complaints
       SET cluster_id = $1,
           advocate_id = $2
       WHERE id = ANY($3::uuid[])
       RETURNING id`,
      [cluster.id, auth.userId, complaint_ids],
    );

    await client.query(
      `UPDATE grievance.complaint_clusters
       SET complaint_count = (
         SELECT COUNT(*)::int FROM grievance.complaints WHERE cluster_id = $1
       )
       WHERE id = $1`,
      [cluster.id],
    );

    if (priorClusterIds.length > 0) {
      await client.query(
        `UPDATE grievance.complaint_clusters c
         SET complaint_count = (
           SELECT COUNT(*)::int FROM grievance.complaints WHERE cluster_id = c.id
         )
         WHERE c.id = ANY($1::uuid[])`,
        [priorClusterIds],
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      cluster,
      linked_count: updateResult.rows.length,
      linked_complaint_ids: updateResult.rows.map((r) => r.id),
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('POST /api/complaints/cluster error:', err.message);
    res.status(400).json({ detail: err.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// POST /api/complaints/cluster/:id/add — Add complaints to an existing cluster
// ---------------------------------------------------------------------------
app.post('/api/complaints/cluster/:id/add', async (req, res) => {
  const client = await pool.connect();
  try {
    const auth = await requireRole(req, ['advocate']);
    const { id } = req.params;
    const { complaint_ids } = req.body;

    if (!Array.isArray(complaint_ids) || complaint_ids.length < 1) {
      return res.status(400).json({ detail: 'complaint_ids must include at least 1 complaint' });
    }

    await client.query('BEGIN');

    const clusterExists = await client.query(
      `SELECT id FROM grievance.complaint_clusters WHERE id = $1`,
      [id],
    );
    if (!clusterExists.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ detail: 'Cluster not found' });
    }

    const priorClustersResult = await client.query(
      `SELECT DISTINCT cluster_id FROM grievance.complaints
       WHERE id = ANY($1::uuid[]) AND cluster_id IS NOT NULL`,
      [complaint_ids],
    );
    const priorClusterIds = priorClustersResult.rows
      .map((row) => row.cluster_id as string)
      .filter((clusterId) => clusterId !== id);

    const updateResult = await client.query(
      `UPDATE grievance.complaints
       SET cluster_id = $1,
           advocate_id = $2
       WHERE id = ANY($3::uuid[])
       RETURNING id`,
      [id, auth.userId, complaint_ids],
    );

    await client.query(
      `UPDATE grievance.complaint_clusters
       SET complaint_count = (
         SELECT COUNT(*)::int FROM grievance.complaints WHERE cluster_id = $1
       )
       WHERE id = $1`,
      [id],
    );


    if (priorClusterIds.length > 0) {
      await client.query(
        `UPDATE grievance.complaint_clusters c
         SET complaint_count = (
           SELECT COUNT(*)::int FROM grievance.complaints WHERE cluster_id = c.id
         )
         WHERE c.id = ANY($1::uuid[])`,
        [priorClusterIds],
      );
    }
    await client.query('COMMIT');

    res.json({ cluster_id: id, linked_count: updateResult.rows.length, linked_complaint_ids: updateResult.rows.map((r) => r.id) });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('POST /api/complaints/cluster/:id/add error:', err.message);
    return res.status(400).json({ detail: err.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// PUT /api/complaints/:id/uncluster — Remove wrong cluster assignment
// ---------------------------------------------------------------------------
app.put('/api/complaints/:id/uncluster', async (req, res) => {
  const client = await pool.connect();
  try {
    const auth = await requireRole(req, ['advocate']);
    const { id } = req.params;

    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id, cluster_id FROM grievance.complaints WHERE id = $1`,
      [id],
    );
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ detail: 'Complaint not found' });
    }

    const previousClusterId = existing.rows[0].cluster_id as string | null;

    const result = await client.query(
      `UPDATE grievance.complaints
       SET cluster_id = NULL,
           status = 'open'::grievance.complaint_status,
           advocate_id = $1,
           escalated_at = NULL,
           resolved_at = NULL
       WHERE id = $2
       RETURNING *`,
      [auth.userId, id],
    );

    if (previousClusterId) {
      await client.query(
        `UPDATE grievance.complaint_clusters
         SET complaint_count = (
           SELECT COUNT(*)::int FROM grievance.complaints WHERE cluster_id = $1
         )
         WHERE id = $1`,
        [previousClusterId],
      );
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('PUT /api/complaints/:id/uncluster error:', err.message);
    return res.status(400).json({ detail: err.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// POST /api/complaints/bulk/tags — Assign same tags to selected complaints
// ---------------------------------------------------------------------------
app.post('/api/complaints/bulk/tags', async (req, res) => {
  try {
    const auth = await requireRole(req, ['advocate']);
    const { complaint_ids, tags } = req.body;
    const nextTags = cleanTags(tags);

    if (!Array.isArray(complaint_ids) || complaint_ids.length < 1) {
      return res.status(400).json({ detail: 'complaint_ids must include at least 1 complaint' });
    }

    const result = await pool.query(
      `UPDATE grievance.complaints
       SET tags = $1,
           advocate_id = $2
       WHERE id = ANY($3::uuid[])
       RETURNING id`,
      [nextTags, auth.userId, complaint_ids],
    );

    res.json({ updated_count: result.rows.length, updated_ids: result.rows.map((r) => r.id), tags: nextTags });
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('POST /api/complaints/bulk/tags error:', err.message);
    return res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/complaints/bulk/status — Mark selected complaints status directly
// ---------------------------------------------------------------------------
app.post('/api/complaints/bulk/status', async (req, res) => {
  try {
    const auth = await requireRole(req, ['advocate']);
    const { complaint_ids, status, advocate_note } = req.body;

    if (!['open', 'escalated', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ detail: 'Invalid status. Must be open, escalated, resolved, or rejected' });
    }
    if (!Array.isArray(complaint_ids) || complaint_ids.length < 1) {
      return res.status(400).json({ detail: 'complaint_ids must include at least 1 complaint' });
    }

    const complaintsBefore = await pool.query(
      `SELECT id, status FROM grievance.complaints WHERE id = ANY($1::uuid[])`,
      [complaint_ids],
    );

    const result = await pool.query(
      `UPDATE grievance.complaints
       SET status = $1::grievance.complaint_status,
           advocate_id = $2,
           advocate_note = COALESCE($3, advocate_note),
           escalated_at = CASE
             WHEN $1::grievance.complaint_status = 'escalated'::grievance.complaint_status THEN COALESCE(escalated_at, NOW())
             WHEN $1::grievance.complaint_status = 'open'::grievance.complaint_status THEN NULL
             ELSE escalated_at
           END,
           resolved_at = CASE
             WHEN $1::grievance.complaint_status = 'resolved'::grievance.complaint_status THEN NOW()
             WHEN $1::grievance.complaint_status IN ('open'::grievance.complaint_status, 'escalated'::grievance.complaint_status) THEN NULL
             ELSE resolved_at
           END
       WHERE id = ANY($4::uuid[])
       RETURNING id, status`,
      [status, auth.userId, advocate_note || null, complaint_ids],
    );

    grievancesStatusEvents(complaintsBefore.rows, result.rows, auth.userId);

    res.json({ updated_count: result.rows.length, updated_ids: result.rows.map((r) => r.id), status });
  } catch (err: any) {
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('POST /api/complaints/bulk/status error:', err.message);
    return res.status(400).json({ detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/complaints/cluster/:id/status — Cascade status to child complaints
// ---------------------------------------------------------------------------
app.put('/api/complaints/cluster/:id/status', async (req, res) => {
  const client = await pool.connect();
  try {
    const auth = await requireRole(req, ['advocate']);
    const { id } = req.params;
    const { status, advocate_note } = req.body;

    if (!['open', 'escalated', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ detail: 'Invalid status. Must be open, escalated, resolved, or rejected' });
    }

    await client.query('BEGIN');

    const complaintsBefore = await client.query(
      `SELECT id, status FROM grievance.complaints WHERE cluster_id = $1`,
      [id],
    );

    if (!complaintsBefore.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ detail: 'Cluster has no linked complaints or does not exist' });
    }

    const updateResult = await client.query(
      `UPDATE grievance.complaints
       SET status = $1::grievance.complaint_status,
           advocate_id = $2,
           advocate_note = COALESCE($3, advocate_note),
           escalated_at = CASE
             WHEN $1::grievance.complaint_status = 'escalated'::grievance.complaint_status THEN COALESCE(escalated_at, NOW())
             WHEN $1::grievance.complaint_status = 'open'::grievance.complaint_status THEN NULL
             ELSE escalated_at
           END,
           resolved_at = CASE
             WHEN $1::grievance.complaint_status = 'resolved'::grievance.complaint_status THEN NOW()
             WHEN $1::grievance.complaint_status IN ('open'::grievance.complaint_status, 'escalated'::grievance.complaint_status) THEN NULL
             ELSE resolved_at
           END
       WHERE cluster_id = $4
       RETURNING id, status`,
      [status, auth.userId, advocate_note || null, id],
    );

    await client.query('COMMIT');

    grievancesStatusEvents(complaintsBefore.rows, updateResult.rows, auth.userId);

    res.json({
      cluster_id: id,
      cascaded_status: status,
      affected_count: updateResult.rows.length,
      complaint_ids: updateResult.rows.map((row) => row.id),
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.message === 'Forbidden') {
      return res.status(403).json({ detail: 'Advocate access required' });
    }
    if (err.message?.includes('token')) {
      return res.status(401).json({ detail: err.message });
    }
    console.error('PUT /api/complaints/cluster/:id/status error:', err.message);
    res.status(400).json({ detail: err.message });
  } finally {
    client.release();
  }
});

function grievancesStatusEvents(
  beforeRows: Array<{ id: string; status: string }>,
  afterRows: Array<{ id: string; status: string }>,
  advocateId: string,
) {
  const beforeMap = new Map(beforeRows.map((r) => [r.id, r.status]));
  afterRows.forEach((row) => {
    const prev = beforeMap.get(row.id);
    if (prev !== row.status) {
      grievanceEvents.emit('complaint.status_changed', {
        complaint_id: row.id,
        old_status: prev,
        new_status: row.status,
        changed_by: advocateId,
        changed_at: new Date().toISOString(),
      });
    }
  });
}

// Legacy compatibility routes currently used in some pages.
app.get('/complaints', (req, res) => {
  req.url = '/api/complaints/public';
  app.handle(req, res);
});

app.post('/complaints', (req, res) => {
  req.url = '/api/complaints';
  app.handle(req, res);
});

app.get('/complaints/mine', (req, res) => {
  req.url = '/api/complaints/mine';
  app.handle(req, res);
});

app.listen(PORT, () => {
  console.log(`Grievance Service running on port ${PORT}`);
});
