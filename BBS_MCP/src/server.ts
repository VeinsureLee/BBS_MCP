import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadFromEnv, ConfigError } from './config/load.js';
import { initLogger, getLogger } from './runtime/logger.js';
import { registerTools } from './tools/index.js';

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

  const server = new McpServer({
    name: 'bbs-mcp',
    version: '0.0.0',
  });

  // M0: graph 永远 disabled。M4 计划再启用
  registerTools(server, { config, graphEnabled: false });

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
