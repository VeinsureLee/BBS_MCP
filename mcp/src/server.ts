import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadAndResolvePaths } from 'bbs-crawler';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { loadMcpConfigFromEnv, ConfigError } from './config/load.js';
import { initLoggerFromEnv, getLogger } from './runtime/logger.js';
import { initCrawler, shutdownCrawler, warmUpBrowser } from './runtime/crawler.js';
import { BoardLockManager } from './runtime/locks.js';
import { registerTools } from './tools/index.js';
import { registerResources } from './resources/index.js';

const SITE_KEY = 'school-bbs';

function readPackageVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // server.ts compiles to dist/server.js; package.json is one level up
  const pkgPath = path.resolve(here, '..', 'package.json');
  try {
    return (JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }).version ?? '0.0.0';
  } catch { return '0.0.0'; }
}

async function main(): Promise<void> {
  // 1. .env + path resolution (crawler-owned; mcp piggybacks before reading its own env)
  loadAndResolvePaths();

  // 2. mcp's own config (just 2 env vars)
  let cfg;
  try {
    cfg = loadMcpConfigFromEnv();
  } catch (e) {
    console.error('mcp config error:', (e as ConfigError).message);
    process.exit(2);
  }

  // 3. logger
  initLoggerFromEnv({ logDir: cfg.logDir });
  const log = getLogger();
  const version = readPackageVersion();
  const startedAt = Date.now();
  log.info({ logDir: cfg.logDir, graphEnabled: cfg.graphEnabled, version }, 'bbs-mcp starting');

  // 4. single Crawler instance, browser persists for entire process lifetime
  // (idleTimeoutMs:0 disables BrowserPool's idle auto-close — see spec §5).
  const crawler = await initCrawler({ siteKey: SITE_KEY, idleTimeoutMs: 0 });

  // 5. server + tools + resources
  const server = new McpServer({ name: 'bbs-mcp', version });
  const locks = new BoardLockManager();
  registerTools(server, {
    crawler,
    locks,
    graphEnabled: cfg.graphEnabled,
    version,
    startedAt,
    siteKey: SITE_KEY,
  });
  registerResources(server, { crawler });

  // 6. shutdown hooks
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    log.info({ signal }, 'bbs-mcp shutting down');
    try {
      await shutdownCrawler();
    } catch (e) {
      log.warn({ err: String(e) }, 'shutdown error');
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // 7. transport (connect first so list_tools/ping are immediately responsive)
  await server.connect(new StdioServerTransport());
  log.info({ tools: 13, resources: 1 }, 'bbs-mcp listening on stdio');

  // async warm-up: launch browser + verify login. Does NOT block connect.
  // Spec §4: server startup is technical readiness only — NO data scraping.
  void warmUpBrowser(SITE_KEY).then(
    () => log.info('mcp: warm-up complete (browser ready, logged in)'),
    (e) => log.warn({ err: String(e) }, 'mcp: warm-up failed; agent should call forum_login or check env credentials'),
  );
}

main().catch((e) => {
  try {
    getLogger().error(e, 'fatal');
  } catch {
    console.error('fatal:', e);
  }
  process.exit(1);
});
