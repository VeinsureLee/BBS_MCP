import { z } from 'zod';
import type { ReadContext } from './list-sites.js';

export const listSectionsTool = {
  name: 'forum_list_sections',
  description: 'List the discussion-area tree (forum + sub_forum nodes) of a site, flat with parent_id for tree reconstruction.',
  inputSchema: z.object({ site_key: z.string() }),
  async handler(input: { site_key: string }, ctx: ReadContext) {
    return ctx.crawler.readers.listSections(input.site_key);
  },
};
