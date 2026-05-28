import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Crawler } from 'bbs-crawler';
import { buildForumTree, forumTreeUri } from './forum-tree.js';

export function registerResources(server: McpServer, opts: { crawler: Crawler }): void {
  server.resource(
    'forum-tree',
    forumTreeUri,
    async (_uri) => ({
      contents: [{
        uri: forumTreeUri,
        mimeType: 'application/json',
        text: JSON.stringify(await buildForumTree(opts.crawler)),
      }],
    }),
  );
}
