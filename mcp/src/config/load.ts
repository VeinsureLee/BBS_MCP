import { parseMcpConfig, type McpConfig } from './schema.js';

export class ConfigError extends Error {
  constructor(message: string, public cause?: unknown) { super(message); this.name = 'ConfigError'; }
}

/**
 * Read mcp's own config from process.env. Only 2 vars belong to mcp:
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
