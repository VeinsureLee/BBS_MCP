import { z } from 'zod';
import type { Readers, BoardRow } from '../../runtime/sqlite-readers.js';
import { buildFreshness, type Freshness } from '../../runtime/freshness.js';

export const listBoardsInputSchema = z.object({
  site_key: z.string().optional(),
});

export interface ListBoardsContext {
  readers: Readers;
  graphEnabled: boolean;
}

export interface ListBoardsResult {
  boards: BoardRow[];
  freshness: Freshness;
}

export const listBoardsTool = {
  name: 'forum_list_boards',
  description: 'List all boards (leaf nodes that hold threads) with metadata.',
  inputSchema: listBoardsInputSchema,
  async handler(
    input: z.infer<typeof listBoardsInputSchema>,
    ctx: ListBoardsContext,
  ): Promise<ListBoardsResult> {
    const boards = ctx.readers.listBoards(input.site_key);
    return {
      boards,
      freshness: buildFreshness({ graphEnabled: ctx.graphEnabled }),
    };
  },
};
