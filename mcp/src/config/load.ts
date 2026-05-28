import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { parseMcpConfig, parseLegacyMcpConfig, type McpConfig, type LegacyMcpConfig } from './schema.js';

export class ConfigError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Resolve a path field from the config file relative to the config file's
 * directory (NOT the process cwd). This makes a single `bbs-mcp.config.json`
 * portable: the same file works no matter where the user launches the server
 * from — Claude Desktop, a different shell, or a sibling project — as long
 * as the relative paths inside it are written relative to the config itself.
 */
function resolveAgainst(baseDir: string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return isAbsolute(value) ? value : resolve(baseDir, value);
}

export function loadMcpConfig(configPath: string): LegacyMcpConfig {
  const abs = resolve(configPath);
  const baseDir = dirname(abs);

  let raw: unknown;
  try {
    const text = readFileSync(abs, 'utf-8');
    raw = JSON.parse(text);
  } catch (e) {
    throw new ConfigError(`failed to read/parse config at ${abs}`, e);
  }

  let parsed: LegacyMcpConfig;
  try {
    parsed = parseLegacyMcpConfig(raw);
  } catch (e) {
    throw new ConfigError(`config validation failed for ${abs}`, e);
  }

  // Resolve every path-bearing field against the config file's directory so
  // downstream code can treat them as absolute paths without thinking about
  // the launching process's cwd.
  parsed.data_dir = resolveAgainst(baseDir, parsed.data_dir)!;
  if (parsed.crawler.config_path) {
    parsed.crawler.config_path = resolveAgainst(baseDir, parsed.crawler.config_path);
  }
  if (parsed.graph.database_config_path) {
    parsed.graph.database_config_path = resolveAgainst(baseDir, parsed.graph.database_config_path);
  }
  if (parsed.logging.file) {
    parsed.logging.file = resolveAgainst(baseDir, parsed.logging.file);
  }

  return parsed;
}

export function loadFromEnv(): LegacyMcpConfig {
  const path = process.env.BBS_MCP_CONFIG;
  if (!path) {
    throw new ConfigError('BBS_MCP_CONFIG env var is required');
  }
  return loadMcpConfig(path);
}

/**
 * Post-refactor entry point. Reads only the 2 mcp-owned env vars:
 *   BBS_MCP_LOG_DIR       — pino log file directory (default ".logs/mcp")
 *   BBS_MCP_GRAPH_ENABLED — "true" to enable graph integration (default false)
 *
 * All crawler-side env (DATABASE_PATH, SCHOOL_BBS_*, BROWSER_*, RATE_*, etc.)
 * is owned and parsed by bbs-crawler's loadAndResolvePaths + parseConfig.
 * mcp does NOT re-parse them.
 */
export function loadMcpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): McpConfig {
  try {
    return parseMcpConfig({
      logDir: env.BBS_MCP_LOG_DIR,
      graphEnabled: env.BBS_MCP_GRAPH_ENABLED === 'true',
    });
  } catch (e) {
    throw new ConfigError('mcp config validation failed', e);
  }
}
