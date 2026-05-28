import { z } from 'zod';
import type { Crawler } from 'bbs-crawler';
import type { BoardLockManager } from '../../runtime/locks.js';

export interface CrawlBoardContext { crawler: Crawler; locks: BoardLockManager; siteKey: string; }

export const crawlBoardTool = {
  name: 'forum_crawl_board',
  description: "Crawl a board's thread list (recent=incremental, deep=N pages), persisting summaries to SQLite. Serialized per board.",
  inputSchema: z.object({
    board_node_id: z.number().int().positive(),
    mode: z.enum(['recent', 'deep']),
    max_pages: z.number().int().positive().max(50).default(3),
  }),
  async handler(
    input: { board_node_id: number; mode: 'recent'|'deep'; max_pages?: number },
    ctx: CrawlBoardContext,
  ) {
    const board = await ctx.crawler.readers.getBoardById(input.board_node_id);
    if (!board) throw new Error(`board ${input.board_node_id} not found`);
    return ctx.locks.runForBoard(input.board_node_id, async () => {
      const startedAt = Date.now();
      const r = await ctx.crawler.service.listThreadsByName({
        siteKey: ctx.siteKey,
        boardName: board.name,
        mode: input.mode === 'recent' ? 'incremental' : 'pages',
        pages: input.mode === 'deep' ? (input.max_pages ?? 3) : undefined,
      });
      return {
        threads_seen: r.threads.length,
        threads_new: r.threads.length,
        elapsed_s: Math.round((Date.now() - startedAt) / 1000),
      };
    });
  },
};
