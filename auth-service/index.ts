import express from 'express';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import cors from 'cors';

const app = express();
const PORT = 8001;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_fairgig_softec_2026';
const JWT_SECRET_UINT8 = new TextEncoder().encode(JWT_SECRET);

app.use(cors());
app.use(express.json());

async function getDb() {
  return open({
    filename: './fairgig.db',
    driver: sqlite3.Database
  });
}

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ detail: 'Invalid credentials' });
  }

  const token = await new SignJWT({ sub: user.id, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET_UINT8);

  res.json({ access_token: token, role: user.role, user_id: user.id });
});

// GET /auth/me
app.get('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ detail: 'Missing token' });
  
  const token = authHeader.split(' ')[1];
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_UINT8);
    const db = await getDb();
    const user = await db.get('SELECT id, name, email, role, city_zone, category FROM users WHERE id = ?', [payload.sub]);
    if (!user) return res.status(404).json({ detail: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(403).json({ detail: 'Invalid token' });
  }
});

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
