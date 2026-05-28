import { z } from 'zod';
import type { Crawler } from 'bbs-crawler';

export interface CrawlThreadContext { crawler: Crawler; siteKey: string; }

export const crawlThreadTool = {
  name: 'forum_crawl_thread',
  description: "Crawl a single thread's full posts by URL or composite id (`{boardKey}/{articleId}`). Persists to SQLite.",
  inputSchema: z.object({
    site_key: z.string(),
    url: z.string().url().optional(),
    thread_id: z.string().regex(/^[^/]+\/\d+$/).optional(),
    max_replies: z.number().int().positive().optional(),
  }).refine((v) => Boolean(v.url) !== Boolean(v.thread_id), {
    message: 'provide exactly one of `url` or `thread_id`',
  }),
  async handler(
    input: { site_key: string; url?: string; thread_id?: string; max_replies?: number },
    ctx: CrawlThreadContext,
  ) {
    if (input.url) {
      const out = await ctx.crawler.service.fetchThread({
        siteKey: input.site_key,
        url: input.url,
        persist: true,
        maxReplies: input.max_replies,
      });
      return { thread: out.thread, persisted: true, thread_id: out.threadId };
    }
    if (input.thread_id) {
      const thread = await ctx.crawler.service.fetchThreadById({
        siteKey: input.site_key,
        threadId: input.thread_id,
        maxReplies: input.max_replies,
      });
      return { thread, persisted: true };
    }
    throw new Error('unreachable: schema refine should reject');
  },
};
