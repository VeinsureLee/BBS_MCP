import { z } from 'zod';
import type { Crawler } from 'bbs-crawler';

export interface StatusContext {
  crawler: Crawler;
  graphEnabled: boolean;
  version: string;
  startedAt: number;
  siteKey?: string;
}

const LARGE = 100000;

export const statusTool = {
  name: 'forum_status',
  description: "Snapshot of mcp server and underlying data: row counts, login state, last crawl time, graph flag, version, uptime.",
  inputSchema: z.object({}),
  async handler(_input: Record<string, never>, ctx: StatusContext) {
    const siteKey = ctx.siteKey ?? 'school-bbs';
    const { readers } = ctx.crawler;

    const sites = (await readers.listSites()).length;
    const sections = (await readers.listSections(siteKey)).length;
    const boards = await readers.listBoards(siteKey);
    let threads_pinned = 0;
    let threads_plain = 0;
    // TODO(perf): once crawler.readers has a `countThreadsByBoard(boardId, kind?)`
    // helper, replace this loop with O(boards) SELECT COUNT(*) queries instead
    // of fetching rows just to take .length. For a single-site forum with ~30
    // boards this is acceptable; for >100 boards consider the optimization.
    for (const b of boards) {
      if (!b.dbPath) continue;
      threads_pinned += (await readers.listThreadsByBoard(b.id, { kind: 'pinned', limit: LARGE })).length;
      threads_plain += (await readers.listThreadsByBoard(b.id, { kind: 'plain', limit: LARGE })).length;
    }

    let logged_in = false;
    try {
      logged_in = await ctx.crawler.withLoggedInPage(async () => true);
    } catch {
      logged_in = false;
    }

    return {
      counts: {
        sites,
        sections,
        boards: boards.length,
        threads_total: threads_pinned + threads_plain,
        threads_pinned,
        threads_plain,
      },
      logged_in,
      session_expires_at: null as string | null,
      last_crawled_at: null as string | null,
      graph_enabled: ctx.graphEnabled,
      version: ctx.version,
      uptime_seconds: Math.floor((Date.now() - ctx.startedAt) / 1000),
    };
  },
};
