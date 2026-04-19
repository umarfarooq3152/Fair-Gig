import dotenv from 'dotenv';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn, type ChildProcess } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname);

type ServiceConfig = {
  name: string;
  port: number;
  cwd?: string;
  command: string;
  args: string[];
  shell?: boolean;
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

/**
 * Prefer, in order:
 * 1. PYTHON_CMD from env / .env
 * 2. Repo `venv` (where you should `pip install -r .../requirements.txt`)
 * 3. `python` / `python3` on PATH
 *
 * Never use `py -3` on Windows — it breaks many installs.
 */
function resolvePython(): string {
  const fromEnv = process.env.PYTHON_CMD?.trim();
  if (fromEnv) return fromEnv;

  const winVenv = path.join(repoRoot, 'venv', 'Scripts', 'python.exe');
  const unixVenv = path.join(repoRoot, 'venv', 'bin', 'python3');
  const unixVenvAlt = path.join(repoRoot, 'venv', 'bin', 'python');
  const dotUnixVenv = path.join(repoRoot, '.venv', 'bin', 'python3');
  const dotUnixVenvAlt = path.join(repoRoot, '.venv', 'bin', 'python');

  if (isWindows) {
    if (fs.existsSync(winVenv)) return winVenv;
  } else {
    if (fs.existsSync(unixVenv)) return unixVenv;
    if (fs.existsSync(unixVenvAlt)) return unixVenvAlt;
    if (fs.existsSync(dotUnixVenv)) return dotUnixVenv;
    if (fs.existsSync(dotUnixVenvAlt)) return dotUnixVenvAlt;
  }

  if (fs.existsSync(unixVenv)) return unixVenv;
  if (fs.existsSync(unixVenvAlt)) return unixVenvAlt;
  if (fs.existsSync(winVenv)) return winVenv;

  return isWindows ? 'python' : 'python3';
}

const pythonCmd = resolvePython();

const uvicornArgs = (port: number) =>
  ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', String(port), '--reload'] as const;

const frontendDir = path.join(repoRoot, 'frontend');

const services: ServiceConfig[] = [
  {
    name: 'Auth Service',
    port: 8001,
    cwd: path.join(repoRoot, 'auth-service'),
    command: pythonCmd,
    args: [...uvicornArgs(8001)],
  },
  {
    name: 'Earnings Service',
    port: 8002,
    cwd: repoRoot,
    command: isWindows ? 'node.exe' : 'node',
    args: ['earnings-service/index.js'],
  },
  {
    name: 'Anomaly Service',
    port: 8003,
    cwd: path.join(repoRoot, 'anomaly-service'),
    command: pythonCmd,
    args: [...uvicornArgs(8003)],
  },
  {
    name: 'Grievance Service',
    port: 8004,
    cwd: repoRoot,
    command: 'npx',
    args: ['--yes', 'tsx', 'grievance-service/index.ts'],
    shell: true,
  },
  {
    name: 'Analytics Service',
    port: 8005,
    cwd: path.join(repoRoot, 'analytics-service'),
    command: pythonCmd,
    args: [...uvicornArgs(8005)],
  },
  {
    name: 'Frontend (Next.js)',
    port: 3000,
    cwd: frontendDir,
    /**
     * Use npx to properly resolve next from node_modules/.bin on all platforms.
     * This avoids PATH resolution issues with cmd.exe on Windows.
     */
    command: isWindows ? 'npx.cmd' : 'npx',
    args: ['next', 'dev', '-p', '3000'],
    shell: isWindows,
  },
];

const children: ChildProcess[] = [];

function startChild(service: ServiceConfig) {
  let proc: ChildProcess;

  try {
    proc = spawn(service.command, service.args, {
      cwd: service.cwd ?? repoRoot,
      stdio: 'inherit',
      shell: service.shell === true,
      env: { ...process.env, FORCE_COLOR: '1' },
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

  console.log(`ℹ️ Using Python: ${pythonCmd}`);
  try {
    execSync(`"${pythonCmd}" -c "import uvicorn"`, { stdio: 'pipe', windowsHide: true, timeout: 15000 });
  } catch {
    console.warn('⚠️ `uvicorn` is not installed for this Python. Auth / Anomaly / Analytics will exit until you run:');
    console.warn(
      `   "${pythonCmd}" -m pip install -r auth-service\\requirements.txt -r anomaly-service\\requirements.txt -r analytics-service\\requirements.txt`,
    );
    console.warn('   Or create .\\venv, pip install there, and set PYTHON_CMD in .env to .\\venv\\Scripts\\python.exe');
  }

  const venvMarker = isWindows
    ? path.join(repoRoot, 'venv', 'Scripts', 'python.exe')
    : path.join(repoRoot, 'venv', 'bin', 'python3');
  if (!fs.existsSync(venvMarker)) {
    console.log(
      'ℹ️ Tip: use a project venv with FastAPI deps (uvicorn, etc.):\n' +
        `   ${isWindows ? 'python -m venv venv && .\\venv\\Scripts\\pip install -r auth-service\\requirements.txt -r anomaly-service\\requirements.txt -r analytics-service\\requirements.txt' : 'python3 -m venv venv && ./venv/bin/pip install -r auth-service/requirements.txt -r anomaly-service/requirements.txt -r analytics-service/requirements.txt'}`,
    );
  }
  const hasNext = fs.existsSync(path.join(frontendDir, 'node_modules', 'next'));
  if (!hasNext) {
    console.error(
      '❌ Install Next.js in frontend first, then re-run:\n   npm install --prefix frontend\n   (Orchestrator will skip Frontend until this exists.)',
    );
  }

  for (const service of services) {
    // eslint-disable-next-line no-await-in-loop
    const inUse = await isPortInUse(service.port);
    if (inUse) {
      console.log(`ℹ️ ${service.name} already running on port ${service.port}. Skipping.`);
      continue;
    }

    if (service.name === 'Frontend (Next.js)' && !hasNext) {
      console.log(`ℹ️ ${service.name} skipped (no frontend/node_modules/next).`);
      continue;
    }

    console.log(`▶ Starting ${service.name} on port ${service.port}...`);
    startChild(service);
  }

  console.log('✅ Service orchestrator is active. Press Ctrl+C to stop started services.');
}

void main();
