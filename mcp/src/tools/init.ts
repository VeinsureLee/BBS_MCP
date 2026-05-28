import { z } from 'zod';
import type { Crawler } from 'bbs-crawler';

export interface InitContext { crawler: Crawler; siteKey: string; }

let initInflight: Promise<unknown> | null = null;

/** Process-level init mutex. Serializes all forum_init calls. */
function withInitMutex<T>(fn: () => Promise<T>): Promise<T> {
  const exec = async (): Promise<T> => {
    try { return await fn(); }
    finally { initInflight = null; }
  };
  if (initInflight) {
    const next = initInflight.then(() => {
      initInflight = exec();
      return initInflight as Promise<T>;
    });
    return next;
  }
  initInflight = exec();
  return initInflight as Promise<T>;
}

export const initTool = {
  name: 'forum_init',
  description: 'Run one or more initialization steps (equivalent to `npm run init:*`). Process-level mutex prevents concurrent inits.',
  inputSchema: z.object({
    step: z.enum(['sections', 'boards', 'pinned', 'refresh_stats', 'all']),
    target: z.object({
      section_key: z.string().optional(),
      board_name: z.string().optional(),
      board_node_ids: z.array(z.number().int().positive()).optional(),
    }).optional(),
  }),
  async handler(
    input: { step: 'sections'|'boards'|'pinned'|'refresh_stats'|'all'; target?: { section_key?: string; board_name?: string; board_node_ids?: number[] } },
    ctx: InitContext,
  ) {
    return withInitMutex(async () => {
      switch (input.step) {
        case 'sections':
          await ctx.crawler.runInitSections();
          return { step: 'sections', ok: true };
        case 'boards':
          await ctx.crawler.runInitBoards();
          return { step: 'boards', ok: true };
        case 'pinned': {
          let boards;
          if (input.target?.board_node_ids?.length) {
            boards = [];
            for (const id of input.target.board_node_ids) {
              const b = await ctx.crawler.readers.getBoardById(id);
              if (!b) throw new Error(`board ${id} not found`);
              boards.push(b);
            }
          } else {
            boards = await ctx.crawler.readers.listBoards(ctx.siteKey);
          }
          await ctx.crawler.runInitPinned(boards as any);
          return { step: 'pinned', ok: true, boards_processed: boards.length };
        }
        case 'refresh_stats': {
          const t = input.target ?? {};
          const r = await ctx.crawler.runRefreshBoardStats({
            sectionKey: t.section_key,
            boardName: t.board_name,
            all: !t.section_key && !t.board_name,
          } as any);
          return { step: 'refresh_stats', sections_visited: r.sectionsVisited, boards_updated: r.boardsUpdated };
        }
        case 'all':
          await ctx.crawler.runInitSections();
          await ctx.crawler.runInitBoards();
          await ctx.crawler.runInitPinned(await ctx.crawler.readers.listBoards(ctx.siteKey) as any);
          return { step: 'all', ok: true };
      }
    });
  },
};
