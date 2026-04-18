import express from 'express';
import { createServer as createViteServer } from 'vite';
import proxy from 'express-http-proxy';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

async function startServer() {
  // --- Verify DATABASE_URL is configured ---
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in .env — run neon_database.sql on your Neon instance first.');
    process.exit(1);
  }

  // --- Start Microservices ---
  const services = [
    { name: 'Auth', path: './auth-service/index.ts', port: 8001 },
    { name: 'Earnings', path: './earnings-service/index.ts', port: 8002 },
    { name: 'Anomaly', path: './anomaly-service/index.ts', port: 8003 },
    { name: 'Grievance', path: './grievance-service/index.ts', port: 8004 },
    { name: 'Analytics', path: './analytics-service/index.ts', port: 8005 },
  ];

  services.forEach(s => {
    console.log(`Starting ${s.name} Service...`);
    fork(s.path, { execArgv: ['--import', 'tsx/esm'] });
  });

  const app = express();

  // Stream multipart/binary bodies directly to downstream services (screenshots/CSV uploads).
  const streamingProxyOptions = { parseReqBody: false };

  // --- API Gateway Routes ---
  app.use('/api/auth', proxy('http://localhost:8001'));
  app.use('/api/shifts', proxy('http://localhost:8002', streamingProxyOptions));
  app.use('/api/verifier', proxy('http://localhost:8002', streamingProxyOptions));
  app.use('/api/anomaly', proxy('http://localhost:8003'));
  app.use('/api/analyze', proxy('http://localhost:8003/analyze'));
  app.use('/api/grievances', proxy('http://localhost:8004/complaints'));
  app.use('/api/complaints', proxy('http://localhost:8004/complaints'));
  app.use('/api/analytics', proxy('http://localhost:8005'));

  // --- Frontend Integration ---
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 FairGig API Gateway running on http://localhost:${PORT}`);
    console.log(`--------------------------------------------------`);
    services.forEach(s => console.log(`[${s.name}] -> Port ${s.port}`));
  });
}

startServer().catch(console.error);
