import { z } from 'zod';
import type { CrawlerRuntime } from '../../runtime/crawler-runtime.js';
import type { BoardLockManager } from '../../runtime/locks.js';
import { McpToolError } from '../../errors.js';

// Single object schema (no z.union) so .shape works for MCP SDK.
// Either { board_node_id, mode? } OR { thread_url, force? }; handler validates.
export const crawlInputSchema = z.object({
  board_node_id: z.number().int().positive().optional(),
  mode: z.enum(['recent', 'deep']).default('recent'),
  max_pages: z.number().int().positive().optional(),
  thread_url: z.string().url().optional(),
  force: z.boolean().default(false),
});

export interface CrawlContext {
  crawler: CrawlerRuntime;
  locks: BoardLockManager;
}

export const crawlTool = {
  name: 'forum_crawl',
  description:
    'Trigger crawl of a board (board_node_id + mode) or a single thread (thread_url). Synchronous: blocks until done.',
  inputSchema: crawlInputSchema,
  async handler(
    input: z.infer<typeof crawlInputSchema>,
    ctx: CrawlContext,
  ): Promise<unknown> {
    if (input.board_node_id !== undefined) {
      const board_node_id = input.board_node_id;
      return ctx.locks.runForBoard(board_node_id, () =>
        ctx.crawler.crawlBoard({
          board_node_id,
          mode: input.mode,
          max_pages: input.max_pages,
        }),
      );
    }
    if (input.thread_url) {
      return ctx.crawler.crawlThread({
        thread_url: input.thread_url,
        force: input.force,
      });
    }
    throw new McpToolError(
      'mcp.invalid_input',
      'forum_crawl requires either { board_node_id, mode? } or { thread_url, force? }',
    );
  },
};
