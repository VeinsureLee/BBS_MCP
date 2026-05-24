import { z } from 'zod';
import type { Readers, ThreadRow } from '../../runtime/sqlite-readers.js';
import { buildFreshness, type Freshness } from '../../runtime/freshness.js';
import { McpToolError } from '../../errors.js';

export const threadsByBoardInputSchema = z.object({
  board_node_id: z.number().int().positive(),
  kind: z.enum(['pinned', 'plain', 'all']).default('all'),
  since: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(20),
  offset: z.number().int().min(0).default(0),
});

export interface ThreadsByBoardContext {
  readers: Readers;
  graphEnabled: boolean;
}

export interface ThreadsByBoardResult {
  threads: ThreadRow[];
  freshness: Freshness;
}

export const threadsByBoardTool = {
  name: 'forum_threads_by_board',
  description: 'List threads in a board, filtered by pinned/plain and posted_at.',
  inputSchema: threadsByBoardInputSchema,
  async handler(
    input: z.infer<typeof threadsByBoardInputSchema>,
    ctx: ThreadsByBoardContext,
  ): Promise<ThreadsByBoardResult> {
    const board = ctx.readers.getBoardById(input.board_node_id);
    if (!board) {
      throw new McpToolError(
        'crawler.board_not_found',
        `board with node_id=${input.board_node_id} not found`,
      );
    }
    const { threads } = ctx.readers.threadsByBoard(input.board_node_id, {
      kind: input.kind,
      since: input.since,
      limit: input.limit,
      offset: input.offset,
    });
    return {
      threads,
      freshness: buildFreshness({
        board_last_crawled_at: board.last_crawled_at,
        threads,
        graphEnabled: ctx.graphEnabled,
      }),
    };
  },
};
