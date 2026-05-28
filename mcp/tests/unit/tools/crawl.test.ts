import { describe, it, expect, vi } from 'vitest';
import { crawlBoardTool } from '../../../src/tools/crawl/crawl-board';
import { crawlThreadTool } from '../../../src/tools/crawl/crawl-thread';

function mkLocks() {
  const runForBoard = vi.fn(async (_id: number, fn: () => Promise<unknown>) => fn());
  return { runForBoard };
}

describe('crawlBoardTool', () => {
  it('looks up board name then calls listThreadsByName in incremental mode', async () => {
    const list = vi.fn(async () => ({ threads: [{ id: 1, url: 'existing-1' }, { id: 2, url: 'new-1' }], nextCursor: null, state: {} as any }));
    const ctx: any = {
      crawler: {
        readers: {
          getBoardById: async () => ({ id: 7, siteKey: 'school-bbs', boardKey: 'B', name: '版面1' }),
          listThreadsByBoard: async () => [{ url: 'existing-1' } as any],
        },
        service: { listThreadsByName: list },
      },
      locks: mkLocks(),
      siteKey: 'school-bbs',
    };
    const out = await crawlBoardTool.handler({ board_node_id: 7, mode: 'recent' }, ctx);
    expect(list).toHaveBeenCalledWith({ siteKey: 'school-bbs', boardName: '版面1', mode: 'incremental', pages: undefined });
    expect(out.threads_seen).toBe(2);
    expect(out.threads_new).toBe(1);  // only 'new-1' is new
  });

  it('uses pages mode when mode=deep with max_pages', async () => {
    const list = vi.fn(async () => ({ threads: [], nextCursor: null, state: {} as any }));
    const ctx: any = {
      crawler: { readers: { getBoardById: async () => ({ name: 'B', id: 1, siteKey: 's', boardKey: 'B' }), listThreadsByBoard: async () => [] }, service: { listThreadsByName: list } },
      locks: mkLocks(),
      siteKey: 's',
    };
    await crawlBoardTool.handler({ board_node_id: 1, mode: 'deep', max_pages: 5 }, ctx);
    expect(list).toHaveBeenCalledWith({ siteKey: 's', boardName: 'B', mode: 'pages', pages: 5 });
  });

  it('throws when board not found', async () => {
    const ctx: any = {
      crawler: { readers: { getBoardById: async () => null }, service: { listThreadsByName: vi.fn() } },
      locks: mkLocks(),
      siteKey: 's',
    };
    await expect(crawlBoardTool.handler({ board_node_id: 999, mode: 'recent' }, ctx)).rejects.toThrow(/not found/i);
  });

  it('serializes through locks.runForBoard', async () => {
    const list = vi.fn(async () => ({ threads: [], nextCursor: null, state: {} as any }));
    const locks = mkLocks();
    const ctx: any = {
      crawler: { readers: { getBoardById: async () => ({ name: 'B', id: 1, siteKey: 's', boardKey: 'B' }), listThreadsByBoard: async () => [] }, service: { listThreadsByName: list } },
      locks,
      siteKey: 's',
    };
    await crawlBoardTool.handler({ board_node_id: 1, mode: 'recent' }, ctx);
    expect(locks.runForBoard).toHaveBeenCalledTimes(1);
    expect(locks.runForBoard.mock.calls[0]![0]).toBe(1);
  });
});

describe('crawlThreadTool', () => {
  it('uses fetchThread for url variant', async () => {
    const fetchThread = vi.fn(async () => ({ thread: { url: 'u', title: 't', posts: [] as any[], fetchedAt: 'x' }, persisted: true, threadId: 1 }));
    const ctx: any = { crawler: { service: { fetchThread, fetchThreadById: vi.fn() } }, siteKey: 's' };
    const out = await crawlThreadTool.handler({ site_key: 's', url: 'https://x/article/B/1' }, ctx);
    expect(fetchThread).toHaveBeenCalledWith({ siteKey: 's', url: 'https://x/article/B/1', persist: true, maxReplies: undefined });
    expect(out.thread_id).toBe(1);
  });

  it('uses fetchThreadById for thread_id variant', async () => {
    const fetchThreadById = vi.fn(async () => ({ url: 'x', title: 't', posts: [] as any[], fetchedAt: 'x' }));
    const ctx: any = { crawler: { service: { fetchThread: vi.fn(), fetchThreadById } }, siteKey: 's' };
    await crawlThreadTool.handler({ site_key: 's', thread_id: 'B/1' }, ctx);
    expect(fetchThreadById).toHaveBeenCalledWith({ siteKey: 's', threadId: 'B/1', maxReplies: undefined });
  });

  it('rejects when both url and thread_id are given (or neither)', async () => {
    const ctx: any = { crawler: { service: { fetchThread: vi.fn(), fetchThreadById: vi.fn() } }, siteKey: 's' };
    // schema-level refine should reject these; the tool's handler validates input first via .parse
    // Note: handler receives already-validated input from SDK, so we test via parse here:
    expect(() => crawlThreadTool.inputSchema.parse({ site_key: 's' })).toThrow();
    expect(() => crawlThreadTool.inputSchema.parse({ site_key: 's', url: 'https://x/a/1', thread_id: 'B/1' })).toThrow();
  });
});
