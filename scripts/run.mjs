#!/usr/bin/env node
/**
 * Wrapper that loads `.env` from project root into process.env,
 * then spawns the given command. Used by root package.json scripts so
 * subprocesses (npm workspace scripts, the MCP server, init scripts)
 * see the unified env without each workspace maintaining its own .env.
 *
 * Implementation notes:
 *   - Self-contained env parser (no `dotenv` dependency). Supports
 *     KEY=VALUE, comments, blank lines, surrounding quotes.
 *   - Does NOT override existing process.env entries (so OS-level env
 *     wins over .env, matching dotenv's default behavior).
 *   - Missing `.env` is fine — runs the command with whatever env exists.
 *
 * Usage:
 *   node scripts/run.mjs <cmd> [args...]
 *   node scripts/run.mjs npm run -w bbs-crawler init:sections
 *   node scripts/run.mjs node mcp/dist/server.js
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path) {
  if (!existsSync(path)) return 0;
  const text = readFileSync(path, 'utf-8');
  let count = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip a trailing inline comment when the value isn't quoted.
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    // Strip surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
      count += 1;
    }
  }
  return count;
}

const rootEnv = resolve('.env');
loadEnvFile(rootEnv);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('usage: node scripts/run.mjs <cmd> [args...]');
  process.exit(1);
}

const [cmd, ...rest] = args;
const isWindows = process.platform === 'win32';

// On Windows, Node 20+ refuses to spawn `.cmd`/`.bat` files directly with
// shell:false (EINVAL), AND emits DEP0190 if we use shell:true. The clean
// workaround is to invoke `cmd.exe /c <cmd> <args...>` ourselves — no shell
// flag needed, no warning. This also means we don't need to manually quote
// since cmd.exe handles argv via its own parsing (and our hardcoded args
// don't contain shell metacharacters).
const proc = isWindows
  ? spawn('cmd.exe', ['/c', cmd, ...rest], {
      stdio: 'inherit',
      env: process.env,
    })
  : spawn(cmd, rest, {
      stdio: 'inherit',
      env: process.env,
    });
proc.on('exit', (code) => process.exit(code ?? 1));
proc.on('error', (err) => {
  console.error(`[run.mjs] failed to spawn ${cmd}: ${err.message}`);
  process.exit(1);
});
