#!/usr/bin/env node
/**
 * One-shot setup orchestrator. Run from project root:
 *   npm run setup
 *
 * What it does:
 *   1. Clones BBS_Crawler and BBS_Database from GitHub if missing.
 *   2. Copies `.env.example` to `.env` if `.env` is missing (does NOT overwrite).
 *   3. Runs `npm install` to link workspaces.
 *   4. Builds bbs-crawler (so bbs-mcp can import its compiled dist).
 *   5. Builds bbs-mcp.
 *   6. Installs Playwright's Chromium browser into a PROJECT-LOCAL cache
 *      (`.cache/ms-playwright/`), NOT into the user-global default
 *      (`~/.cache/ms-playwright/`). Removes the install if the user later
 *      deletes the project directory.
 *
 * Safe to re-run: every step is idempotent.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const REPOS = {
  BBS_Crawler: 'https://github.com/VeinsureLee/BBS_Crawler.git',
  BBS_Database: 'https://github.com/VeinsureLee/BBS_Database.git',
};

const BROWSERS_DIR = resolve('.cache/ms-playwright');

function step(label, fn) {
  console.log(`\n[setup] ${label}`);
  fn();
}

const isWindows = process.platform === 'win32';

// Same Windows .cmd-spawn caveat as scripts/run.mjs — wrap via cmd.exe /c
// to avoid both the EINVAL (shell:false) and DEP0190 (shell:true) cases.
function run(cmd, args, opts = {}) {
  const finalCmd = isWindows ? 'cmd.exe' : cmd;
  const finalArgs = isWindows ? ['/c', cmd, ...args] : args;
  const r = spawnSync(finalCmd, finalArgs, {
    stdio: 'inherit',
    ...opts,
  });
  if (r.status !== 0) {
    throw new Error(`command failed: ${cmd} ${args.join(' ')} (exit ${r.status})`);
  }
}

const npm = isWindows ? 'npm.cmd' : 'npm';

step('clone subprojects (if missing)', () => {
  for (const [name, remote] of Object.entries(REPOS)) {
    if (existsSync(name)) {
      console.log(`  ${name}/ already present, skipping clone`);
      continue;
    }
    console.log(`  cloning ${name} from ${remote}...`);
    run('git', ['clone', remote, name]);
  }
});

step('prepare .env (if missing)', () => {
  const envPath = resolve('.env');
  const examplePath = resolve('.env.example');
  if (existsSync(envPath)) {
    console.log('  .env already present, leaving as-is');
  } else if (!existsSync(examplePath)) {
    console.log('  .env.example missing too; skipping (manual creation required)');
  } else {
    copyFileSync(examplePath, envPath);
    console.log('  copied .env.example -> .env');
    console.log('  EDIT .env with your BBS credentials before running `npm run init`');
  }
});

step('npm install (workspace)', () => {
  run(npm, ['install']);
});

step('build bbs-crawler', () => {
  run(npm, ['run', '-w', 'bbs-crawler', 'build']);
});

step('build bbs-mcp', () => {
  run(npm, ['run', '-w', 'bbs-mcp', 'build']);
});

step('install Playwright chromium (project-local)', () => {
  mkdirSync(BROWSERS_DIR, { recursive: true });
  const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: BROWSERS_DIR };
  try {
    run(isWindows ? 'npx.cmd' : 'npx', ['playwright', 'install', 'chromium'], { env });
    console.log(`  browsers installed to ${BROWSERS_DIR}`);
  } catch (e) {
    console.error(`  playwright install failed: ${e.message}`);
    console.error('  you can retry later: PLAYWRIGHT_BROWSERS_PATH=./.cache/ms-playwright npx playwright install chromium');
  }
});

console.log(`
[setup] DONE.

Next steps:
  1. Edit .env — fill in SCHOOL_BBS_USERNAME / SCHOOL_BBS_PASSWORD / SCHOOL_BBS_BASE_URL
  2. Run \`npm run init\` to log in and bootstrap crawler data
  3. Copy bbs-mcp.config.example.json to bbs-mcp.config.json and adjust paths
  4. Register the server in Claude Desktop (see README.md)

For details: README.md
`);
