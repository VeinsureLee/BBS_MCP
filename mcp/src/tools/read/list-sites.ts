import { z } from 'zod';
import type { Crawler } from 'bbs-crawler';

export interface ReadContext { crawler: Crawler; }

export const listSitesTool = {
  name: 'forum_list_sites',
  description: 'List all BBS sites known to this MCP server (currently always one: school-bbs).',
  inputSchema: z.object({}),
  async handler(_input: Record<string, never>, ctx: ReadContext) {
    return ctx.crawler.readers.listSites();
  },
};
