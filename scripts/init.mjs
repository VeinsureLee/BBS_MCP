#!/usr/bin/env node
/**
 * Orchestrates `npm run init` end-to-end:
 *   1. Check for crawler storage state (BBS_Crawler/.state/*.json)
 *   2. If missing → run login (interactive; pops a browser)
 *      If present → skip login (avoid re-popping browser on every re-init)
 *   3. init:crawler:sections
 *   4. init:crawler:boards
 *   5. init:db (placeholder for M4+)
 *
 * Each substep delegates to an existing root npm script. Storage state check
 * is just "does BBS_Crawler/.state/ contain any .json file"; the crawler's
 * own login script writes <siteKey>.json to that dir.
 */

import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const isWindows = process.platform === 'win32';

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

console.log('\n[init] init:db...');
run('npm', ['run', 'init:db']);

console.log('\n[init] DONE.');
