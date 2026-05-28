import { z } from 'zod';
import type { ReadContext } from './list-sites.js';

export const searchLocalTool = {
  name: 'forum_search_local',
  description:
    'Local title search across stored threads (SQLite LIKE). NOT a web crawl. Returns matched threads from any board, ordered by posted_at DESC.',
  inputSchema: z.object({
    site_key: z.string(),
    keyword: z.string().min(1),
    limit: z.number().int().positive().max(500).default(50),
  }),
  async handler(
    input: { site_key: string; keyword: string; limit?: number },
    ctx: ReadContext
  ) {
    return ctx.crawler.readers.searchThreadsByTitle(
      input.site_key,
      input.keyword,
      input.limit ?? 50
    );
  },
};
