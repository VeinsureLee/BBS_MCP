import { describe, it, expect, vi } from 'vitest';
import { initTool } from '../../../src/tools/init';

function mkCrawler(opts: {
  sectionsBeforeAfter?: [number, number];
  boardsBeforeAfter?: [number, number];
  pinnedBeforeAfter?: number[];  // sequence consumed by repeated listThreadsByBoard calls
} = {}) {
  const sectionCounts = opts.sectionsBeforeAfter ?? [0, 0];
  const boardCounts = opts.boardsBeforeAfter ?? [0, 0];
  const pinnedCounts = opts.pinnedBeforeAfter ?? [];
  let sectionCallIdx = 0, boardCallIdx = 0, pinnedCallIdx = 0;
  return {
    readers: {
      listSections: vi.fn(async () => Array(sectionCounts[sectionCallIdx++] ?? 0).fill({ id: 1 })),
      listBoards: vi.fn(async () => Array(boardCounts[boardCallIdx++] ?? 0).fill({ id: 1, siteKey: 's', boardKey: 'B', name: 'b', moderators: [], parentId: null, dbPath: 'p' })),
      listThreadsByBoard: vi.fn(async (_id: number, optsArg: { kind?: string }) => {
        if (optsArg.kind === 'pinned') return Array(pinnedCounts[pinnedCallIdx++] ?? 0).fill({ id: 1 });
        return [];
      }),
      getBoardById: vi.fn(async (id: number) => ({ id, siteKey: 's', boardKey: 'B', name: 'b', moderators: [], parentId: null, dbPath: 'p' })),
    },
    runInitSections: vi.fn(async () => {}),
    runInitBoards: vi.fn(async () => {}),
    runInitPinned: vi.fn(async () => {}),
    runRefreshBoardStats: vi.fn(async () => ({ sectionsVisited: 1, boardsUpdated: 3 })),
  };
}

describe('initTool', () => {
  it('rejects step:"all" at schema level (spec v2 removed it)', () => {
    expect(() => initTool.inputSchema.parse({ step: 'all' })).toThrow();
  });

  it('sections step returns added + total_after', async () => {
    const crawler = mkCrawler({ sectionsBeforeAfter: [2, 5] });
    const out = await initTool.handler({ step: 'sections' }, { crawler: crawler as any, siteKey: 's' });
    expect(crawler.runInitSections).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ step: 'sections', added: 3, total_after: 5 });
  });

  it('boards step returns sections_processed + boards_added + skipped=0', async () => {
    const crawler = mkCrawler({
      sectionsBeforeAfter: [3, 7],
      boardsBeforeAfter: [5, 12],
    });
    const out = await initTool.handler({ step: 'boards' }, { crawler: crawler as any, siteKey: 's' });
    expect(crawler.runInitBoards).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ step: 'boards', sections_processed: 4, boards_added: 7, boards_skipped: 0 });
  });

  it('pinned step with target.board_node_ids returns boards_done + threads_added + threads_failed=0', async () => {
    // 2 boards. Call sequence for listThreadsByBoard with kind:pinned:
    //   board3 before, board4 before, [runInitPinned], board3 after, board4 after
    // pinnedBeforeAfter [1, 1, 3, 5] → before = 1+1=2, after = 3+5=8, added=6
    const crawler = mkCrawler({ pinnedBeforeAfter: [1, 1, 3, 5] });
    const out = await initTool.handler(
      { step: 'pinned', target: { board_node_ids: [3, 4] } },
      { crawler: crawler as any, siteKey: 's' },
    );
    expect(crawler.runInitPinned).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ step: 'pinned', boards_done: 2, threads_added: 6, threads_failed: 0 });
  });

  it('pinned step without target uses all boards', async () => {
    // 1 board returned by listBoards. Before-after sequence per board: [0, 2]
    const crawler = mkCrawler({ boardsBeforeAfter: [1, 1], pinnedBeforeAfter: [0, 2] });
    const out = await initTool.handler({ step: 'pinned' }, { crawler: crawler as any, siteKey: 's' });
    expect(crawler.readers.listBoards).toHaveBeenCalled();
    expect((out as any).boards_done).toBe(1);
    expect((out as any).threads_added).toBe(2);
  });

  it('pinned step throws when an id is not found', async () => {
    const crawler = mkCrawler();
    crawler.readers.getBoardById = vi.fn(async () => null);
    await expect(
      initTool.handler({ step: 'pinned', target: { board_node_ids: [999] } }, { crawler: crawler as any, siteKey: 's' }),
    ).rejects.toThrow(/not found/i);
  });

  it('refresh_stats returns runner output verbatim with named keys', async () => {
    const crawler = mkCrawler();
    const out = await initTool.handler({ step: 'refresh_stats', target: { section_key: 'F' } }, { crawler: crawler as any, siteKey: 's' });
    expect((crawler.runRefreshBoardStats as any).mock.calls[0][0]).toEqual({ sectionKey: 'F', boardName: undefined, all: false });
    expect(out).toEqual({ step: 'refresh_stats', sections_visited: 1, boards_updated: 3 });
  });

  it('refresh_stats with no target uses all: true', async () => {
    const crawler = mkCrawler();
    await initTool.handler({ step: 'refresh_stats' }, { crawler: crawler as any, siteKey: 's' });
    expect((crawler.runRefreshBoardStats as any).mock.calls[0][0]).toEqual({ sectionKey: undefined, boardName: undefined, all: true });
  });

  it('serializes 3+ concurrent calls via process-level mutex', async () => {
    const crawler = mkCrawler();
    const order: string[] = [];
    crawler.runInitSections = vi.fn(async () => {
      order.push('s-start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('s-end');
    }) as any;
    crawler.runInitBoards = vi.fn(async () => {
      order.push('b-start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('b-end');
    }) as any;
    crawler.runRefreshBoardStats = vi.fn(async () => {
      order.push('r-start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('r-end');
      return { sectionsVisited: 0, boardsUpdated: 0 };
    }) as any;
    const p1 = initTool.handler({ step: 'sections' }, { crawler: crawler as any, siteKey: 's' });
    const p2 = initTool.handler({ step: 'boards' }, { crawler: crawler as any, siteKey: 's' });
    const p3 = initTool.handler({ step: 'refresh_stats' }, { crawler: crawler as any, siteKey: 's' });
    await Promise.all([p1, p2, p3]);
    expect(order).toEqual(['s-start','s-end','b-start','b-end','r-start','r-end']);
  });
});
