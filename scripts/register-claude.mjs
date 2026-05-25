#!/usr/bin/env node
/**
 * Register THIS project clone with a Claude MCP client.
 *
 *   npm run register                  → write .mcp.json in THIS project root
 *                                       (i.e. BBS_MCP/)
 *   npm run register -- --at <dir>    → write .mcp.json in <dir> instead
 *                                       (use when you `claude` from a PARENT
 *                                        directory that contains BBS_MCP, e.g.
 *                                        `npm run register -- --at ..`)
 *   npm run register -- --desktop     → write user-global Claude Desktop config
 *                                       (%APPDATA%\Claude\claude_desktop_config.json
 *                                        on Windows, ~/Library/Application Support
 *                                        on macOS, ~/.config on Linux). Ignores --at.
 *   npm run unregister                → remove from this project's .mcp.json
 *   npm run unregister -- --at <dir>  → remove from <dir>/.mcp.json
 *   npm run unregister -- --desktop   → remove from Claude Desktop config
 *
 * Why --at exists:
 *   Claude Code CLI looks for `.mcp.json` only in its own cwd at startup. If
 *   your workflow is `cd <parent>/test && claude` and BBS_MCP is at
 *   <parent>/test/BBS_MCP/, then `test/` is where .mcp.json needs to live.
 *   `npm run register -- --at ..` from inside BBS_MCP/ writes it there.
 *
 * Server entry name:
 *   `MCP_SERVER_NAME` from .env (default "bbs"). Change per clone if you have
 *   multiple BBS_MCP installs on the same machine.
 *
 * Both targets use the same JSON shape:
 *   { "mcpServers": { "<name>": { "command", "args", "env" } } }
 * so the merge logic is identical.
 *
 * All paths in the generated entry are ABSOLUTE — the launching client sets
 * cwd to its own location, so relative paths break.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const remove = args.includes('--remove');
const useDesktop = args.includes('--desktop');

// --at <dir>  : extract the value following --at, if present.
let atDir;
const atIdx = args.indexOf('--at');
if (atIdx >= 0) {
  if (atIdx + 1 >= args.length || args[atIdx + 1].startsWith('--')) {
    console.error('--at requires a directory argument');
    process.exit(1);
  }
  atDir = args[atIdx + 1];
}

function claudeDesktopConfigPath() {
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA;
    if (!appdata) throw new Error('APPDATA env var is not set; cannot locate Claude Desktop config');
    return join(appdata, 'Claude', 'claude_desktop_config.json');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

function readEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const rawLine of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = readEnvFile(resolve('.env'));
const serverName = (env.MCP_SERVER_NAME || process.env.MCP_SERVER_NAME || 'bbs').trim();
if (!serverName || /[^A-Za-z0-9_-]/.test(serverName)) {
  console.error(`MCP_SERVER_NAME must be alphanumeric plus _ and - (got "${serverName}")`);
  process.exit(1);
}

const serverJs = resolve('mcp', 'dist', 'server.js');
const configJson = resolve('bbs-mcp.config.json');

if (!remove) {
  if (!existsSync(serverJs)) {
    console.error(`server build not found: ${serverJs}`);
    console.error('run `npm run build` first');
    process.exit(1);
  }
  if (!existsSync(configJson)) {
    console.error(`config not found: ${configJson}`);
    console.error('copy bbs-mcp.config.example.json to bbs-mcp.config.json and edit, then re-run');
    process.exit(1);
  }
}

let targetPath;
let targetLabel;
if (useDesktop) {
  if (atDir) {
    console.error('--at cannot be combined with --desktop (Claude Desktop has a fixed global path)');
    process.exit(1);
  }
  targetPath = claudeDesktopConfigPath();
  targetLabel = 'Claude Desktop user-global config';
} else {
  const baseDir = atDir ? resolve(atDir) : resolve('.');
  if (!existsSync(baseDir)) {
    console.error(`--at directory does not exist: ${baseDir}`);
    process.exit(1);
  }
  if (!statSync(baseDir).isDirectory()) {
    console.error(`--at target is not a directory: ${baseDir}`);
    process.exit(1);
  }
  targetPath = join(baseDir, '.mcp.json');
  targetLabel = `.mcp.json in ${baseDir} (Claude Code CLI)`;
}

let cfg = {};
if (existsSync(targetPath)) {
  const raw = readFileSync(targetPath, 'utf-8');
  try {
    cfg = raw.trim() === '' ? {} : JSON.parse(raw);
  } catch (e) {
    console.error(`failed to parse existing ${targetPath}: ${e.message}`);
    console.error('fix the JSON manually or move it aside, then re-run');
    process.exit(1);
  }
}
if (typeof cfg !== 'object' || cfg === null) cfg = {};
if (!cfg.mcpServers || typeof cfg.mcpServers !== 'object') cfg.mcpServers = {};

const toJsonPath = (p) => p.replace(/\\/g, '/');

if (remove) {
  if (cfg.mcpServers[serverName]) {
    delete cfg.mcpServers[serverName];
    console.log(`removed "${serverName}" from ${targetLabel}`);
  } else {
    console.log(`"${serverName}" not present in ${targetLabel}; nothing to remove`);
  }
} else {
  cfg.mcpServers[serverName] = {
    command: 'node',
    args: [toJsonPath(serverJs)],
    env: {
      BBS_MCP_CONFIG: toJsonPath(configJson),
    },
  };
  console.log(`registered "${serverName}" in ${targetLabel}`);
  console.log(`  command: node`);
  console.log(`  args: ["${toJsonPath(serverJs)}"]`);
  console.log(`  env.BBS_MCP_CONFIG: ${toJsonPath(configJson)}`);
}

mkdirSync(dirname(targetPath), { recursive: true });
writeFileSync(targetPath, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
console.log(`wrote ${targetPath}`);
console.log('');
if (useDesktop) {
  console.log('Fully restart Claude Desktop (system tray too) to pick up the change.');
} else {
  console.log('Claude Code CLI auto-discovers .mcp.json when started in this directory.');
  console.log('Restart any running `claude` session in this folder to pick up the change.');
}
