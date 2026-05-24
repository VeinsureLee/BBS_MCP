import { z } from 'zod';
import type { Readers, ThreadRow, PostRow } from '../../runtime/sqlite-readers.js';
import { buildFreshness, type Freshness } from '../../runtime/freshness.js';
import { McpToolError } from '../../errors.js';

// Note: MCP SDK 1.x expects a ZodRawShape (the .shape of a ZodObject), so we
// use a single object schema with optional fields and validate "either/or" in
// the handler instead of z.union (which has no .shape).
export const getThreadInputSchema = z.object({
  url: z.string().url().optional(),
  forum_db: z.string().min(1).optional(),
  thread_id: z.number().int().positive().optional(),
});

export interface GetThreadContext {
  readers: Readers;
  graphEnabled: boolean;
}

export interface GetThreadResult {
  thread: ThreadRow;
  posts: PostRow[];
  freshness: Freshness;
}

export const getThreadTool = {
  name: 'forum_get_thread',
  description: 'Fetch a single thread plus all its posts. Identify by url, or by (forum_db, thread_id).',
  inputSchema: getThreadInputSchema,
  async handler(
    input: z.infer<typeof getThreadInputSchema>,
    ctx: GetThreadContext,
  ): Promise<GetThreadResult> {
    let result;
    if (input.url) {
      result = ctx.readers.getThreadByUrl(input.url);
    } else if (input.forum_db && input.thread_id !== undefined) {
      result = ctx.readers.getThreadById(input.forum_db, input.thread_id);
    } else {
      throw new McpToolError(
        'mcp.invalid_input',
        'forum_get_thread requires either { url } or { forum_db, thread_id }',
      );
    }
    if (!result) {
      throw new McpToolError('crawler.board_not_found', `thread not found: ${JSON.stringify(input)}`);
    }
    return {
      thread: result.thread,
      posts: result.posts,
      freshness: buildFreshness({
        threads: [result.thread],
        graphEnabled: ctx.graphEnabled,
      }),
    };
  },
};
