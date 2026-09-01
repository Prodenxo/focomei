#!/usr/bin/env node
/**
 * Libera a porta do backend antes de `npm run dev` (evita EADDRINUSE).
 * Windows: netstat + taskkill. Unix: fuser ou lsof.
 */
import { execSync } from 'node:child_process';
import { platform } from 'node:os';

const port = String(process.env.PORT || '3333').trim();

function killPidsOnWindows() {
  let out = '';
  try {
    out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch {
    return;
  }

  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.includes('LISTENING')) continue;
    const parts = trimmed.split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      console.log(`[free-dev-port] encerrou PID ${pid} na porta ${port}`);
    } catch {
      /* processo já sumiu */
    }
  }
}

function killPidsOnUnix() {
  try {
    const pids = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' }).trim();
    if (!pids) return;
    for (const pid of pids.split(/\s+/)) {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      console.log(`[free-dev-port] encerrou PID ${pid} na porta ${port}`);
    }
  } catch {
    /* porta livre */
  }
}

if (platform() === 'win32') {
  killPidsOnWindows();
} else {
  killPidsOnUnix();
}
