import { describe, it, expect, vi } from 'vitest';
import { crawlTool } from '../../src/tools/core/crawl.js';
import { BoardLockManager } from '../../src/runtime/locks.js';
import { CrawlerRuntime } from '../../src/runtime/crawler-runtime.js';

function fakeRuntime() {
  const calls: any[] = [];
  const factory = async () => ({
    crawlBoard: vi.fn(async (input: any) => {
      calls.push({ op: 'board', input });
      await new Promise((r) => setTimeout(r, 10));
      return { threads_seen: 4, threads_new: 1 };
    }),
    crawlThread: vi.fn(async (input: any) => {
      calls.push({ op: 'thread', input });
      return { thread_id: 42, fetched: true, skipped: false };
    }),
    isLoggedIn: vi.fn().mockResolvedValue(true),
    sessionExpiresAt: vi.fn().mockResolvedValue(null),
    shutdown: vi.fn(),
  });
  return {
    runtime: new CrawlerRuntime({ siteKey: 'school-bbs', dataDir: '/tmp', factory }),
    calls,
  };
}

describe('crawl tool', () => {
  it('crawls a board (sync mode) and returns counts', async () => {
    const { runtime } = fakeRuntime();
    const locks = new BoardLockManager();
    // Cast as any: handler expects z.infer<typeof crawlInputSchema> which has
    // force:boolean (defaulted). Test passes minimal shape without force field.
    const r = await crawlTool.handler(
      { board_node_id: 1, mode: 'recent' } as any,
      { crawler: runtime, locks },
    );
    expect((r as any).threads_new).toBe(1);
    expect((r as any).threads_seen).toBe(4);
  });

  it('coalesces concurrent calls to the same board', async () => {
    const { runtime, calls } = fakeRuntime();
    const locks = new BoardLockManager();
    await Promise.all([
      crawlTool.handler({ board_node_id: 1, mode: 'recent' } as any, { crawler: runtime, locks }),
      crawlTool.handler({ board_node_id: 1, mode: 'recent' } as any, { crawler: runtime, locks }),
    ]);
    expect(calls.filter((c) => c.op === 'board')).toHaveLength(1);
  });

  it('allows different boards in parallel', async () => {
    const { runtime, calls } = fakeRuntime();
    const locks = new BoardLockManager();
    await Promise.all([
      crawlTool.handler({ board_node_id: 1, mode: 'recent' } as any, { crawler: runtime, locks }),
      crawlTool.handler({ board_node_id: 2, mode: 'recent' } as any, { crawler: runtime, locks }),
    ]);
    expect(calls.filter((c) => c.op === 'board')).toHaveLength(2);
  });

  it('routes thread_url input to crawlThread', async () => {
    const { runtime, calls } = fakeRuntime();
    const locks = new BoardLockManager();
    const r = await crawlTool.handler(
      { thread_url: 'https://example.edu/t/42' } as any,
      { crawler: runtime, locks },
    );
    expect(r).toEqual({ thread_id: 42, fetched: true, skipped: false });
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe('thread');
  });
});
