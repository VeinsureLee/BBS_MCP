#!/usr/bin/env node
/**
 * Register THIS project clone with a Claude MCP client.
 *
 *   npm run register              → write project-root .mcp.json
 *                                   (Claude Code CLI auto-discovers it when
 *                                    started in this directory; this is the
 *                                    "local-only, this folder configures
 *                                    this folder" path.)
 *   npm run register -- --desktop → write user-global Claude Desktop config
 *                                   (%APPDATA%\Claude\claude_desktop_config.json
 *                                    on Windows, ~/Library/Application Support
 *                                    on macOS, ~/.config on Linux)
 *   npm run unregister            → remove from .mcp.json
 *   npm run unregister -- --desktop → remove from Claude Desktop config
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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const remove = args.includes('--remove');
const useDesktop = args.includes('--desktop');

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

const targetPath = useDesktop ? claudeDesktopConfigPath() : resolve('.mcp.json');
const targetLabel = useDesktop ? 'Claude Desktop user-global config' : 'project .mcp.json (Claude Code CLI)';

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
