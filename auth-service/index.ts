import express from 'express';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const PORT = 8001;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_fairgig_softec_2026';
const JWT_SECRET_UINT8 = new TextEncoder().encode(JWT_SECRET);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET_UINT8);
}

async function createRefreshToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ sub: userId, role, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET_UINT8);
}

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
app.post('/auth/register', async (req, res) => {
  const { name, email, password, role, city_zone, category, phone } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!name || !normalizedEmail || !password || !role) {
    return res.status(400).json({ detail: 'name, email, password, role are required' });
  }
  if (!['worker', 'verifier', 'advocate'].includes(role)) {
    return res.status(400).json({ detail: 'Invalid role. Must be worker, verifier, or advocate' });
  }
  if (role === 'worker' && !city_zone) {
    return res.status(400).json({ detail: 'city_zone is required for workers' });
  }

  const password_hash = await bcrypt.hash(password, 12);

  try {
    const duplicateCheck = await pool.query(
      `SELECT id FROM auth.users WHERE LOWER(email) = $1 LIMIT 1`,
      [normalizedEmail],
    );

    if (duplicateCheck.rows.length) {
      return res.status(409).json({ detail: 'Email already exists' });
    }

    const result = await pool.query(
      `INSERT INTO auth.users (name, email, password_hash, role, city_zone, category, phone)
       VALUES ($1, $2, $3, $4::auth.user_role, $5::auth.city_zone, $6::auth.worker_category, $7)
       RETURNING id, name, email, role, city_zone, category, phone, avatar_url, bio, is_active, created_at`,
      [name, normalizedEmail, password_hash, role, city_zone || null, category || null, phone || null],
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ detail: 'Email already exists' });
    }
    console.error('Register error:', err.message);
    res.status(500).json({ detail: 'Could not register user' });
  }
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return res.status(400).json({ detail: 'email and password are required' });
  }

  const result = await pool.query(
    `SELECT id, name, email, role, password_hash
     FROM auth.users
     WHERE LOWER(email) = $1 AND deleted_at IS NULL AND is_active = TRUE`,
    [normalizedEmail],
  );

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ detail: 'Invalid credentials' });
  }

  // Update last_login_at
  await pool.query(
    `UPDATE auth.users SET last_login_at = NOW() WHERE id = $1`,
    [user.id],
  );

  const access_token = await createAccessToken(String(user.id), user.role);
  const refresh_token = await createRefreshToken(String(user.id), user.role);

  res.json({
    access_token,
    refresh_token,
    token_type: 'bearer',
    role: user.role,
    user_id: user.id,
  });
});

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------
app.post('/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ detail: 'refresh_token is required' });
  }

  try {
    const { payload } = await jwtVerify(refresh_token, JWT_SECRET_UINT8);

    if (payload.type !== 'refresh') {
      return res.status(401).json({ detail: 'Invalid refresh token' });
    }

    const userId = payload.sub as string;
    const role = payload.role as string;

    const access_token = await createAccessToken(userId, role);
    const new_refresh_token = await createRefreshToken(userId, role);

    res.json({
      access_token,
      refresh_token: new_refresh_token,
      token_type: 'bearer',
    });
  } catch {
    res.status(401).json({ detail: 'Invalid or expired refresh token' });
  }
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
app.get('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ detail: 'Missing token' });

  const token = authHeader.split(' ')[1];
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_UINT8);

    const result = await pool.query(
      `SELECT id, name, email, role, city_zone, category, phone,
              avatar_url, bio, is_active, last_login_at, created_at
       FROM auth.users
       WHERE id = $1 AND deleted_at IS NULL`,
      [payload.sub],
    );

    if (!result.rows.length) {
      return res.status(404).json({ detail: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch {
    res.status(403).json({ detail: 'Invalid token' });
  }
});

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
