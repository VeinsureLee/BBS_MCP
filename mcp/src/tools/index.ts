import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Crawler } from 'bbs-crawler';
import { listSitesTool } from './read/list-sites.js';
import { listSectionsTool } from './read/list-sections.js';
import { listBoardsTool } from './read/list-boards.js';
import { sectionDetailTool } from './read/section-detail.js';
import { boardThreadsTool } from './read/board-threads.js';
import { getThreadTool } from './read/get-thread.js';
import { searchLocalTool } from './read/search-local.js';
import { crawlBoardTool } from './crawl/crawl-board.js';
import { crawlThreadTool } from './crawl/crawl-thread.js';
import { initTool } from './init.js';
import { pingTool } from './meta/ping.js';
import { statusTool } from './meta/status.js';
import { toMcpError } from '../errors.js';
import { getLogger } from '../runtime/logger.js';
import type { BoardLockManager } from '../runtime/locks.js';

export interface RegisterOptions {
  crawler: Crawler;
  locks: BoardLockManager;
  graphEnabled: boolean;
  version: string;
  startedAt: number;
  siteKey: string;
}

export function registerTools(server: McpServer, opts: RegisterOptions): void {
  const log = getLogger();
  const readCtx = { crawler: opts.crawler };
  const crawlBoardCtx = { crawler: opts.crawler, locks: opts.locks, siteKey: opts.siteKey };
  const crawlThreadCtx = { crawler: opts.crawler, siteKey: opts.siteKey };
  const initCtx = { crawler: opts.crawler, siteKey: opts.siteKey };
  const statusCtx = { crawler: opts.crawler, graphEnabled: opts.graphEnabled, version: opts.version, startedAt: opts.startedAt, siteKey: opts.siteKey };
  const pingCtx = { version: opts.version, startedAt: opts.startedAt };

  const all = [
    [listSitesTool,     readCtx],
    [listSectionsTool,  readCtx],
    [listBoardsTool,    readCtx],
    [sectionDetailTool, readCtx],
    [boardThreadsTool,  readCtx],
    [getThreadTool,     readCtx],
    [searchLocalTool,   readCtx],
    [crawlBoardTool,    crawlBoardCtx],
    [crawlThreadTool,   crawlThreadCtx],
    [initTool,          initCtx],
    [statusTool,        statusCtx],
    [pingTool,          pingCtx],
  ] as const;

  for (const [tool, ctx] of all) {
    registerOne(server, tool as any, ctx as any, log);
  }
  log.info({ graphEnabled: opts.graphEnabled, registered: all.length }, 'tools registered');
}

function getShape(schema: import('zod').ZodTypeAny): Record<string, import('zod').ZodTypeAny> {
  // ZodObject has .shape; ZodEffects (from .refine) wraps it
  if ((schema as any).shape) return (schema as any).shape;
  if ((schema as any)._def?.schema?.shape) return (schema as any)._def.schema.shape;
  throw new Error(`tool inputSchema has no .shape (and no inner schema): ${schema}`);
}

function registerOne(
  server: McpServer,
  tool: { name: string; description: string; inputSchema: import('zod').ZodTypeAny; handler: (input: any, ctx: any) => Promise<unknown> },
  ctx: unknown,
  log: ReturnType<typeof getLogger>,
): void {
  server.tool(
    tool.name,
    tool.description,
    getShape(tool.inputSchema),
    async (args: Record<string, unknown>) => {
      try {
        const result = await tool.handler(args, ctx);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      } catch (e) {
        const mcpErr = toMcpError(e);
        log.warn({ tool: tool.name, error_code: mcpErr.error_code, msg: mcpErr.message }, 'tool error');
        throw mcpErr;
      }
    },
  );
}
