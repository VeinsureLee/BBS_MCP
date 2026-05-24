import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadFromEnv, ConfigError } from './config/load.js';
import { initLogger, getLogger } from './runtime/logger.js';
import { registerTools } from './tools/index.js';
import { openReaders } from './runtime/sqlite-readers.js';
import { buildForumTree, forumTreeUri } from './resources/forum-tree.js';
import { CrawlerRuntime, realCrawlerFactory } from './runtime/crawler-runtime.js';
import { BoardLockManager } from './runtime/locks.js';

async function main(): Promise<void> {
  let config;
  try {
    config = loadFromEnv();
  } catch (e) {
    // logger 未初始化,直接 stderr
    console.error('config error:', (e as Error).message);
    process.exit(2);
  }

  initLogger(config);
  const log = getLogger();
  log.info({ data_dir: config.data_dir, site: config.crawler.site_key }, 'bbs-mcp starting');

  const readers = openReaders(config.data_dir);

  const crawler = new CrawlerRuntime({
    siteKey: config.crawler.site_key,
    dataDir: config.data_dir,
    factory: realCrawlerFactory,
  });
  const locks = new BoardLockManager();

  const server = new McpServer({
    name: 'bbs-mcp',
    version: '0.0.0',
  });

  // M0: graph 永远 disabled。M4 计划再启用
  registerTools(server, { config, graphEnabled: false, readers, crawler, locks });

  // M1: forum-tree resource
  server.resource(
    'forum-tree',
    forumTreeUri,
    async (_uri) => ({
      contents: [
        {
          uri: forumTreeUri,
          mimeType: 'application/json',
          text: JSON.stringify(buildForumTree(readers)),
        },
      ],
    }),
  );
  log.info('forum-tree resource registered');

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info('bbs-mcp listening on stdio');
}

main().catch((e) => {
  // 此时 logger 可能未初始化
  try {
    getLogger().error(e, 'fatal');
  } catch {
    console.error('fatal:', e);
  }
  process.exit(1);
});
