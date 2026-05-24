import { z } from 'zod';
import type { Readers } from '../../runtime/sqlite-readers.js';
import type { CrawlerRuntime } from '../../runtime/crawler-runtime.js';

export const statusInputSchema = z.object({
  board_node_id: z.number().int().positive().optional(),
});

export interface StatusContext {
  readers: Readers;
  crawler: CrawlerRuntime;
  graphEnabled: boolean;
}

export interface StatusResult {
  session: { logged_in: boolean; expires_at?: string | null };
  graph: { enabled: boolean; node_counts?: unknown };
  board?: {
    last_crawled_at: string | null;
    threads_total: number;
    threads_24h: number;
    pinned_count: number;
  };
  global: {
    sites: number;
    boards: number;
    threads_total: number;
  };
}

export const statusTool = {
  name: 'forum_status',
  description:
    'Status overview: login session (note: session state currently always reports logged_in=false; CrawlerService does not yet expose AuthManager — Task post-M3), graph state, global counts, optionally per-board freshness.',
  inputSchema: statusInputSchema,
  async handler(
    input: z.infer<typeof statusInputSchema>,
    ctx: StatusContext,
  ): Promise<StatusResult> {
    const loggedIn = await ctx.crawler.isLoggedIn();
    const expiresAt = loggedIn ? await ctx.crawler.sessionExpiresAt() : null;

    const sites = ctx.readers.listSites();
    const boards = ctx.readers.listBoards();
    let totalThreads = 0;
    for (const b of boards) totalThreads += b.pinned_count + b.plain_count;

    const result: StatusResult = {
      session: { logged_in: loggedIn, expires_at: expiresAt ?? undefined },
      graph: { enabled: ctx.graphEnabled },
      global: { sites: sites.length, boards: boards.length, threads_total: totalThreads },
    };

    if (input.board_node_id !== undefined) {
      const board = ctx.readers.getBoardById(input.board_node_id);
      if (board) {
        const total = board.pinned_count + board.plain_count;
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const recent = ctx.readers.threadsByBoard(input.board_node_id, {
          kind: 'all',
          since: since24h,
          limit: 10000,
        });
        result.board = {
          last_crawled_at: board.last_crawled_at,
          threads_total: total,
          threads_24h: recent.threads.length,
          pinned_count: board.pinned_count,
        };
      }
    }

    return result;
  },
};
