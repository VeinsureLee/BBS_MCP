import { z } from 'zod';
import type { ReadContext } from './list-sites.js';

export const boardThreadsTool = {
  name: 'forum_board_threads',
  description: 'List threads under a board, paginated, filterable by pinned/plain. Sorted is_pinned DESC, posted_at DESC.',
  inputSchema: z.object({
    board_node_id: z.number().int().positive(),
    kind: z.enum(['all', 'pinned', 'plain']).default('all'),
    limit: z.number().int().positive().max(500).default(50),
    offset: z.number().int().nonnegative().default(0),
  }),
  async handler(
    input: { board_node_id: number; kind?: 'all'|'pinned'|'plain'; limit?: number; offset?: number },
    ctx: ReadContext,
  ) {
    return ctx.crawler.readers.listThreadsByBoard(input.board_node_id, {
      kind: input.kind ?? 'all',
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
    });
  },
};
