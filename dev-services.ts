import dotenv from 'dotenv';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, type ChildProcess } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ServiceConfig = {
  name: string;
  port: number;
  cwd?: string;
  command: string;
  args: string[];
};

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

const isWindows = process.platform === 'win32';
const pythonCmd = process.env.PYTHON_CMD || (isWindows ? 'py' : 'python3');

const services: ServiceConfig[] = [
  {
    name: 'Auth Service',
    port: 8001,
    cwd: path.resolve(__dirname, 'auth-service'),
    command: pythonCmd,
    args: isWindows
      ? ['-3', '-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8001', '--reload']
      : ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8001', '--reload'],
  },
  {
    name: 'Earnings Service',
    port: 8002,
    cwd: path.resolve(__dirname, 'earnings-service'),
    command: isWindows ? 'cmd.exe' : 'tsx',
    args: isWindows ? ['/d', '/s', '/c', 'tsx index.ts'] : ['index.ts'],
  },
  {
    name: 'Anomaly Service',
    port: 8003,
    cwd: path.resolve(__dirname, 'anomaly-service'),
    command: pythonCmd,
    args: isWindows
      ? ['-3', '-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8003', '--reload']
      : ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8003', '--reload'],
  },
  {
    name: 'Grievance Service',
    port: 8004,
    cwd: path.resolve(__dirname, 'grievance-service'),
    command: isWindows ? 'cmd.exe' : 'tsx',
    args: isWindows ? ['/d', '/s', '/c', 'tsx index.ts'] : ['index.ts'],
  },
  {
    name: 'Analytics Service',
    port: 8005,
    cwd: path.resolve(__dirname, 'analytics-service'),
    command: pythonCmd,
    args: isWindows
      ? ['-3', '-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8005', '--reload']
      : ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8005', '--reload'],
  },
  {
    name: 'Frontend',
    port: 3000,
    cwd: path.resolve(__dirname),
    command: isWindows ? 'cmd.exe' : 'npm',
    args: isWindows ? ['/d', '/s', '/c', 'npm --prefix frontend run dev'] : ['--prefix', 'frontend', 'run', 'dev'],
  },
];

const children: ChildProcess[] = [];

function startChild(service: ServiceConfig) {
  let proc: ChildProcess;

  try {
    proc = spawn(service.command, service.args, {
      cwd: service.cwd,
      stdio: 'inherit',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${service.name} failed to start: ${message}`);
    return;
  }

  proc.on('error', (err) => {
    console.error(`❌ ${service.name} failed to start: ${err.message}`);
  });

  proc.on('exit', (code) => {
    if (code !== 0) {
      console.warn(`⚠️ ${service.name} exited with code ${code}`);
    }
  });

  children.push(proc);
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Add it to .env before running dev.');
    process.exit(1);
  }

  for (const service of services) {
    // eslint-disable-next-line no-await-in-loop
    const inUse = await isPortInUse(service.port);
    if (inUse) {
      console.log(`ℹ️ ${service.name} already running on port ${service.port}. Skipping.`);
      continue;
    }

    console.log(`▶ Starting ${service.name} on port ${service.port}...`);
    startChild(service);
  }

  console.log('✅ Service orchestrator is active. Press Ctrl+C to stop started services.');
}

void main();
