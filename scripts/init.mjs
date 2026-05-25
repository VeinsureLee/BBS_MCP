#!/usr/bin/env node
/**
 * Orchestrates `npm run init` end-to-end:
 *   1. Check for crawler storage state (BBS_Crawler/.state/*.json).
 *      Missing → run login (interactive, pops browser).
 *      Present → skip login (don't re-pop browser on every re-init).
 *   2. init:crawler:sections
 *   3. init:crawler:boards
 *   4. [if --full] init:crawler:threads:full   (pinned + plain page 1 across all boards; SLOW)
 *   5. init:db (placeholder for M4+)
 *
 * Usage:
 *   node scripts/init.mjs           ← structure only (fast; threads via MCP on demand)
 *   node scripts/init.mjs --full    ← structure + bulk threads (pinned + plain page 1)
 */

import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const isWindows = process.platform === 'win32';
const full = process.argv.includes('--full');

function run(cmd, args) {
  const finalCmd = isWindows ? 'cmd.exe' : cmd;
  const finalArgs = isWindows ? ['/c', cmd, ...args] : args;
  const r = spawnSync(finalCmd, finalArgs, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n[init] step failed: ${cmd} ${args.join(' ')} (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

const stateDir = resolve('BBS_Crawler', '.state');
const hasState = existsSync(stateDir)
  && readdirSync(stateDir).some((f) => f.endsWith('.json'));

if (hasState) {
  console.log('[init] crawler storage state found, skipping login');
} else {
  console.log('[init] no storage state — running login (browser will pop up)...');
  run('npm', ['run', 'init:crawler:login']);
}

console.log('\n[init] crawling sections...');
run('npm', ['run', 'init:crawler:sections']);

console.log('\n[init] crawling boards...');
run('npm', ['run', 'init:crawler:boards']);

if (full) {
  console.log('\n[init] crawling threads (pinned + plain page 1, all boards) — this can take 20+ minutes...');
  run('npm', ['run', 'init:crawler:threads:full']);
} else {
  console.log('\n[init] skipping threads bulk crawl (run with --full or use forum_crawl via MCP for on-demand)');
}

console.log('\n[init] init:db...');
run('npm', ['run', 'init:db']);

console.log('\n[init] DONE.');
