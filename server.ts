import express from 'express';
import { createServer as createViteServer } from 'vite';
import proxy from 'express-http-proxy';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

function isPortInUse(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket
      .once('connect', () => {
        socket.destroy();
        resolve(true);
      })
      .once('timeout', () => {
        socket.destroy();
        resolve(false);
      })
      .once('error', () => {
        resolve(false);
      })
      .connect(port, host);

    socket.setTimeout(500);
  });
}

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
    { name: 'Grievance', path: './grievance-service/index.ts', port: 8004 },
    { name: 'Analytics', path: './analytics-service/index.ts', port: 8005 },
  ];

  for (const s of services) {
    // Avoid EADDRINUSE crashes when a previous run is still alive.
    // eslint-disable-next-line no-await-in-loop
    const inUse = await isPortInUse(s.port);
    if (inUse) {
      console.log(`${s.name} Service already running on port ${s.port}. Skipping start.`);
      continue;
    }

    console.log(`Starting ${s.name} Service...`);
    fork(s.path, { execArgv: ['--import', 'tsx/esm'] });
  }

  const anomalyInUse = await isPortInUse(8003);
  if (anomalyInUse) {
    console.log('Anomaly Service already running on port 8003. Skipping start.');
  } else {
    const anomalyNodePath = path.resolve(__dirname, './anomaly-service/index.ts');
    if (fs.existsSync(anomalyNodePath)) {
      console.log('Starting Anomaly Service (Node)...');
      fork('./anomaly-service/index.ts', { execArgv: ['--import', 'tsx/esm'] });
    } else {
      console.log('Starting Anomaly Service (Python/FastAPI)...');
      const isWindows = process.platform === 'win32';
      const pythonCmd = process.env.PYTHON_CMD || (isWindows ? 'py' : 'python3');
      const pythonArgs = isWindows
        ? ['-3', '-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8003']
        : ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8003'];

      const anomalyProc = spawn(pythonCmd, pythonArgs, {
        cwd: path.resolve(__dirname, './anomaly-service'),
        stdio: 'inherit',
      });

      anomalyProc.on('error', (err) => {
        console.error('❌ Failed to start Python anomaly service:', err.message);
        console.error('Set PYTHON_CMD in .env if your Python command differs (for example, python or py).');
      });
    }
  }

  const app = express();

  const gatewayInUse = await isPortInUse(PORT);
  if (gatewayInUse) {
    console.log(`FairGig API Gateway is already running on http://localhost:${PORT}. Skipping duplicate start.`);
    return;
  }

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
    console.log('[Anomaly] -> Port 8003');
  });
}

startServer().catch(console.error);
