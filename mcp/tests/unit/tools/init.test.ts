import { describe, it, expect, vi } from 'vitest';
import { initTool } from '../../../src/tools/init';

function mkCrawler() {
  return {
    readers: {
      listBoards: vi.fn(async () => [{ id: 1, siteKey: 's', boardKey: 'B1', name: 'b1', moderators: [], parentId: null, dbPath: 'p' }]),
      getBoardById: vi.fn(async (id: number) => ({ id, siteKey: 's', boardKey: 'B', name: 'b', moderators: [], parentId: null, dbPath: 'p' })),
    },
    runInitSections: vi.fn(async () => {}),
    runInitBoards: vi.fn(async () => {}),
    runInitPinned: vi.fn(async () => {}),
    runRefreshBoardStats: vi.fn(async () => ({ sectionsVisited: 1, boardsUpdated: 3 })),
  };
}

describe('initTool', () => {
  it('sections step calls runInitSections', async () => {
    const crawler = mkCrawler();
    const out = await initTool.handler({ step: 'sections' }, { crawler: crawler as any, siteKey: 's' });
    expect((crawler.runInitSections as any).mock.calls.length).toBe(1);
    expect(out).toEqual({ step: 'sections', ok: true });
  });

  it('boards step calls runInitBoards', async () => {
    const crawler = mkCrawler();
    const out = await initTool.handler({ step: 'boards' }, { crawler: crawler as any, siteKey: 's' });
    expect((crawler.runInitBoards as any).mock.calls.length).toBe(1);
    expect(out).toEqual({ step: 'boards', ok: true });
  });

  it('pinned step with target.board_node_ids uses getBoardById per id', async () => {
    const crawler = mkCrawler();
    const out = await initTool.handler({ step: 'pinned', target: { board_node_ids: [3, 4] } }, { crawler: crawler as any, siteKey: 's' });
    expect((crawler.readers.getBoardById as any).mock.calls.length).toBe(2);
    expect((crawler.runInitPinned as any).mock.calls.length).toBe(1);
    expect((out as any).boards_processed).toBe(2);
  });

  it('pinned step without target uses all boards', async () => {
    const crawler = mkCrawler();
    const out = await initTool.handler({ step: 'pinned' }, { crawler: crawler as any, siteKey: 's' });
    expect((crawler.readers.listBoards as any).mock.calls.length).toBe(1);
    expect((out as any).boards_processed).toBe(1);
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

  it('all step calls sections + boards + pinned sequentially', async () => {
    const crawler = mkCrawler();
    const out = await initTool.handler({ step: 'all' }, { crawler: crawler as any, siteKey: 's' });
    expect((crawler.runInitSections as any).mock.calls.length).toBe(1);
    expect((crawler.runInitBoards as any).mock.calls.length).toBe(1);
    expect((crawler.runInitPinned as any).mock.calls.length).toBe(1);
    expect(out).toEqual({ step: 'all', ok: true });
  });

  it('serializes concurrent calls via process-level mutex', async () => {
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
    const p1 = initTool.handler({ step: 'sections' }, { crawler: crawler as any, siteKey: 's' });
    const p2 = initTool.handler({ step: 'boards' }, { crawler: crawler as any, siteKey: 's' });
    await Promise.all([p1, p2]);
    // sequential: sections must fully finish before boards starts
    expect(order).toEqual(['s-start', 's-end', 'b-start', 'b-end']);
  });
});
