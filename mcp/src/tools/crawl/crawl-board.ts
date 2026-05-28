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
      // Snapshot urls before crawl so we can report a true delta.
      const before = new Set<string>();
      for (const t of await ctx.crawler.readers.listThreadsByBoard(input.board_node_id, { kind: 'all', limit: 100000 })) {
        before.add(t.url);
      }
      const r = await ctx.crawler.service.listThreadsByName({
        siteKey: ctx.siteKey,
        boardName: board.name,
        mode: input.mode === 'recent' ? 'incremental' : 'pages',
        pages: input.mode === 'deep' ? (input.max_pages ?? 3) : undefined,
      });
      const threads_new = r.threads.filter((t) => !before.has(t.url)).length;
      return {
        threads_seen: r.threads.length,
        threads_new,
        elapsed_s: Math.round((Date.now() - startedAt) / 1000),
      };
    });
  },
};
