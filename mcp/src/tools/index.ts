import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { pingTool } from './core/ping.js';
import { listSitesTool } from './core/list-sites.js';
import { listBoardsTool } from './core/list-boards.js';
import { threadsByBoardTool } from './core/threads-by-board.js';
import type { McpConfig } from '../config/schema.js';
import { toMcpError } from '../errors.js';
import { getLogger } from '../runtime/logger.js';
import type { Readers } from '../runtime/sqlite-readers.js';

export interface RegisterOptions {
  config: McpConfig;
  graphEnabled: boolean;
  readers: Readers;
}

export function registerTools(server: McpServer, opts: RegisterOptions): void {
  const log = getLogger();

  const sharedCtx = { readers: opts.readers, graphEnabled: opts.graphEnabled };

  registerTool(server, pingTool, {}, log);
  registerTool(server, listSitesTool, sharedCtx, log);
  registerTool(server, listBoardsTool, sharedCtx, log);
  registerTool(server, threadsByBoardTool, sharedCtx, log);

  log.info({ graphEnabled: opts.graphEnabled, registered: 4 }, 'tools registered');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = { name: string; description: string; inputSchema: { shape: Record<string, import('zod').ZodTypeAny>; parse: (input: unknown) => any }; handler: (input: any, ctx?: any) => Promise<unknown> };

function registerTool(
  server: McpServer,
  tool: AnyTool,
  ctx: any,
  log: ReturnType<typeof getLogger>,
): void {
  // SDK 1.29 McpServer.tool() is deprecated but fully functional.
  // Signature: tool(name, description, paramsShape, callback)
  // The callback receives (args, extra) where args is already parsed/validated by the SDK.
  server.tool(
    tool.name,
    tool.description,
    tool.inputSchema.shape,
    async (args: Record<string, unknown>) => {
      try {
        const result = await tool.handler(args, ctx);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      } catch (e) {
        const mcpErr = toMcpError(e);
        log.warn({ tool: tool.name, error_code: mcpErr.error_code, msg: mcpErr.message }, 'tool error');
        throw mcpErr;
      }
    },
  );
}
