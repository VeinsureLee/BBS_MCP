import { z } from 'zod';
import type { Crawler } from 'bbs-crawler';

export interface InitContext { crawler: Crawler; siteKey: string; }

let initInflight: Promise<unknown> | null = null;

/** Process-level init mutex. Tail-chain serialization. */
function withInitMutex<T>(fn: () => Promise<T>): Promise<T> {
  const result = (initInflight ?? Promise.resolve()).then(() => fn());
  initInflight = result.then(() => {}, () => {});
  return result;
}

const LARGE = 100000;
async function countPinnedAcross(crawler: Crawler, boardIds: number[]): Promise<number> {
  let total = 0;
  for (const id of boardIds) {
    total += (await crawler.readers.listThreadsByBoard(id, { kind: 'pinned', limit: LARGE })).length;
  }
  return total;
}

export const initTool = {
  name: 'forum_init',
  description: 'Run one initialization step (sections | boards | pinned | refresh_stats). Call them sequentially as needed. Each step takes tens of seconds to minutes; check `forum_status` between calls. Process-level mutex prevents concurrent inits.',
  inputSchema: z.object({
    step: z.enum(['sections', 'boards', 'pinned', 'refresh_stats']),
    target: z.object({
      section_key: z.string().optional(),
      board_name: z.string().optional(),
      board_node_ids: z.array(z.number().int().positive()).optional(),
    }).optional(),
  }),
  async handler(
    input: { step: 'sections'|'boards'|'pinned'|'refresh_stats'; target?: { section_key?: string; board_name?: string; board_node_ids?: number[] } },
    ctx: InitContext,
  ) {
    return withInitMutex(async () => {
      switch (input.step) {
        case 'sections': {
          const before = (await ctx.crawler.readers.listSections(ctx.siteKey)).length;
          await ctx.crawler.runInitSections();
          const after = (await ctx.crawler.readers.listSections(ctx.siteKey)).length;
          return { step: 'sections', added: after - before, total_after: after };
        }
        case 'boards': {
          const sectionsBefore = (await ctx.crawler.readers.listSections(ctx.siteKey)).length;
          const boardsBefore = (await ctx.crawler.readers.listBoards(ctx.siteKey)).length;
          await ctx.crawler.runInitBoards();
          const sectionsAfter = (await ctx.crawler.readers.listSections(ctx.siteKey)).length;
          const boardsAfter = (await ctx.crawler.readers.listBoards(ctx.siteKey)).length;
          return {
            step: 'boards',
            sections_processed: sectionsAfter - sectionsBefore,
            boards_added: boardsAfter - boardsBefore,
            boards_skipped: 0,
          };
        }
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
          const ids = boards.map((b) => b.id);
          const before = await countPinnedAcross(ctx.crawler, ids);
          await ctx.crawler.runInitPinned(boards as any);
          const after = await countPinnedAcross(ctx.crawler, ids);
          return {
            step: 'pinned',
            boards_done: boards.length,
            threads_added: after - before,
            threads_failed: 0,
          };
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
      }
    });
  },
};
