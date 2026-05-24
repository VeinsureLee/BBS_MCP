import { z } from 'zod';
import { McpToolError } from '../../errors.js';
import type { Readers, ThreadRow } from '../../runtime/sqlite-readers.js';
import { buildFreshness, type Freshness } from '../../runtime/freshness.js';

export const searchThreadsInputSchema = z.object({
  query: z.string().min(1),
  board_node_id: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export interface SearchThreadsContext {
  readers: Readers;
  graphEnabled: boolean;
}

export interface SearchThreadsResult {
  threads: ThreadRow[];
  freshness: Freshness;
}

export const searchThreadsTool = {
  name: 'forum_search_threads',
  description: 'Lexical (LIKE-based) title search across one board or all boards.',
  inputSchema: searchThreadsInputSchema,
  async handler(
    input: z.infer<typeof searchThreadsInputSchema>,
    ctx: SearchThreadsContext,
  ): Promise<SearchThreadsResult> {
    // Explicit guard: mirrors schema's min(1) so direct handler calls also reject empty
    if (!input.query || input.query.trim().length === 0) {
      throw new McpToolError(
        'mcp.invalid_input',
        'forum_search_threads requires non-empty query',
      );
    }

    const { threads } = ctx.readers.searchTitles(input.query, {
      board_node_id: input.board_node_id,
      limit: input.limit,
    });

    return {
      threads,
      freshness: buildFreshness({
        threads,
        graphEnabled: ctx.graphEnabled,
      }),
    };
  },
};
