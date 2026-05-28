import { z } from 'zod';
import type { ReadContext } from './list-sites.js';

export const sectionDetailTool = {
  name: 'forum_section_detail',
  description: "Headline read tool: returns a discussion area's meta + sub-sections + boards (each with latest daily traffic, pinned thread titles, and recent N plain threads) in one call.",
  inputSchema: z.object({
    site_key: z.string(),
    section_key: z.string(),
    recent_limit: z.number().int().positive().max(100).default(10),
  }),
  async handler(input: { site_key: string; section_key: string; recent_limit?: number }, ctx: ReadContext) {
    return ctx.crawler.readers.getSectionDetail(input.site_key, input.section_key, {
      recentLimit: input.recent_limit ?? 10,
    });
  },
};
