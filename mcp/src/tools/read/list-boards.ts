import { z } from 'zod';
import type { ReadContext } from './list-sites.js';

export const listBoardsTool = {
  name: 'forum_list_boards',
  description: 'List boards under a site, optionally narrowed to those directly under a given parent section.',
  inputSchema: z.object({
    site_key: z.string(),
    parent_section_id: z.number().int().positive().optional(),
  }),
  async handler(input: { site_key: string; parent_section_id?: number }, ctx: ReadContext) {
    return ctx.crawler.readers.listBoards(input.site_key, input.parent_section_id);
  },
};
