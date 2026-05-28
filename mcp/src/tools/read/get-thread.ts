import { z } from 'zod';
import type { ReadContext } from './list-sites.js';

export const getThreadTool = {
  name: 'forum_get_thread',
  description: 'Fetch a stored thread + all its posts by URL. Read-only (does not crawl). Returns null when not found.',
  inputSchema: z.object({
    site_key: z.string(),
    url: z.string().url(),
  }),
  async handler(input: { site_key: string; url: string }, ctx: ReadContext) {
    return ctx.crawler.readers.getThreadByUrl(input.site_key, input.url);
  },
};
