import { z } from 'zod';
import type { Readers } from '../../runtime/sqlite-readers.js';

export const listSitesInputSchema = z.object({});

export interface ListSitesContext {
  readers: Readers;
}

export const listSitesTool = {
  name: 'forum_list_sites',
  description: 'List all BBS sites registered in this MCP instance.',
  inputSchema: listSitesInputSchema,
  async handler(
    _input: z.infer<typeof listSitesInputSchema>,
    ctx: ListSitesContext,
  ): Promise<{ sites: { site_key: string; name: string; base_url: string }[] }> {
    return { sites: ctx.readers.listSites() };
  },
};
