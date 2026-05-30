/**
 * Start Dev Server
 *
 * 1. Starts Docker Compose services (jina-reader) — in background
 * 2. Starts Next.js dev server
 *
 * Cross-platform (Node.js) — no bash/pwsh dependency.
 * Docker runs as a background process so Next.js starts immediately.
 */

const { spawn, execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || '3000';

// ─── Helpers ───────────────────────────────────────────────────────────
const GRAY = '\x1b[2m';
const NC = '\x1b[0m';

function ok(msg) {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}
function info(msg) {
  console.log(`  \x1b[33mℹ\x1b[0m ${msg}`);
}

// ─── 0. Cleanup: kill any zombie process on target port ────────────────
try {
  if (process.platform === 'win32') {
    const result = execSync(
      `netstat -ano | findstr :${PORT} | findstr LISTENING`,
      { encoding: 'utf8', timeout: 5000, shell: true },
    );
    const lines = result.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try {
          execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8', timeout: 3000, shell: true });
          console.log(`  \x1b[35m~\x1b[0m Puerto ${PORT} liberado (PID ${pid})`);
        } catch { /* process already gone */ }
      }
    }
  } else {
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null; true`, { shell: true, timeout: 5000 });
  }
} catch {
  // Port was free — nothing to kill
}

// ─── 1. Clean up stale containers ────────────────────────────────────
try {
  execSync('docker compose down --remove-orphans', { cwd: ROOT, stdio: 'ignore', timeout: 15000, shell: true });
} catch { /* Docker not available — will be caught by up step */ }

// ─── 2. Start Docker services (background) ────────────────────────────
console.log('');
console.log('  ─── Docker Services ───');

const docker = spawn('docker compose up -d', {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

let dockerOutput = '';

docker.stdout.on('data', (chunk) => {
  dockerOutput += chunk.toString();
});

docker.stderr.on('data', (chunk) => {
  dockerOutput += chunk.toString();
});

docker.on('close', (code) => {
  if (code === 0) {     ok('Contenedores corriendo — jina-reader (puerto 3001)');
  } else {
    // Only show the last meaningful lines (skip apt-get noise)
    const lines = dockerOutput
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !l.includes('apt-get') &&
          !l.includes('Reading') &&
          !l.includes('Selecting') &&
          !l.includes('Preparing') &&
          !l.includes('Unpacking') &&
          !l.includes('Setting up') &&
          !l.includes('Processing triggers') &&
          !l.includes('debconf') &&
          !l.includes('Preconfiguring') &&
          !l.includes('#') &&
          !l.startsWith('Get:'),
      );
    const lastLines = lines.slice(-6).join('\n  ');
    if (lastLines) {
      console.error(`  \x1b[31m✗\x1b[0m Error al levantar contenedores Docker:\n  \x1b[31m  ${lastLines}\x1b[0m`);
    }
    info('Docker no disponible — se omiten contenedores');
  }
});

docker.on('error', () => {
  info('Docker no disponible — se omiten contenedores (Docker no instalado)');
});

// ─── 2. Start Next.js dev server ───────────────────────────────────────
console.log('');
console.log('  ─── Next.js Dev Server ───');
console.log(`  ${GRAY}Port: ${PORT}${NC}`);
console.log(`  ${GRAY}URL:  http://localhost:${PORT}${NC}`);
console.log(`  ${GRAY}Press Ctrl+C to stop${NC}`);
console.log('');

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const next = spawn(`${npxCmd} next dev --port ${PORT}`, {
  stdio: 'inherit',
  cwd: ROOT,
  shell: true,
});

next.on('exit', (code) => {
  docker.kill();
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  docker.kill();
  next.kill();
  process.exit();
});
