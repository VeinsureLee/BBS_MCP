import { describe, it, expect, vi } from 'vitest';
import { CrawlerRuntime } from '../../src/runtime/crawler-runtime.js';

describe('CrawlerRuntime', () => {
  it('lazily initializes CrawlerService on first crawlBoard call', async () => {
    const initFake = vi.fn().mockResolvedValue({
      crawlBoard: vi.fn().mockResolvedValue({ threads_seen: 5, threads_new: 2 }),
      crawlThread: vi.fn(),
      isLoggedIn: vi.fn().mockResolvedValue(true),
      sessionExpiresAt: vi.fn().mockResolvedValue(null),
      shutdown: vi.fn(),
    });
    const rt = new CrawlerRuntime({ siteKey: 'school-bbs', dataDir: '/tmp', factory: initFake });
    expect(initFake).not.toHaveBeenCalled();
    const r = await rt.crawlBoard({ board_node_id: 1, mode: 'recent' });
    expect(initFake).toHaveBeenCalledTimes(1);
    expect(r.threads_new).toBe(2);
  });

  it('reuses the same service across calls', async () => {
    const initFake = vi.fn().mockResolvedValue({
      crawlBoard: vi.fn().mockResolvedValue({ threads_seen: 1, threads_new: 0 }),
      crawlThread: vi.fn(),
      isLoggedIn: vi.fn(),
      sessionExpiresAt: vi.fn(),
      shutdown: vi.fn(),
    });
    const rt = new CrawlerRuntime({ siteKey: 'school-bbs', dataDir: '/tmp', factory: initFake });
    await rt.crawlBoard({ board_node_id: 1, mode: 'recent' });
    await rt.crawlBoard({ board_node_id: 2, mode: 'recent' });
    expect(initFake).toHaveBeenCalledTimes(1);
  });

  it('isLoggedIn reads from service or returns false when not initialized', async () => {
    const initFake = vi.fn().mockResolvedValue({
      crawlBoard: vi.fn(),
      crawlThread: vi.fn(),
      isLoggedIn: vi.fn().mockResolvedValue(true),
      sessionExpiresAt: vi.fn().mockResolvedValue('2026-06-01T00:00:00Z'),
      shutdown: vi.fn(),
    });
    const rt = new CrawlerRuntime({ siteKey: 'school-bbs', dataDir: '/tmp', factory: initFake });
    expect(await rt.isLoggedIn()).toBe(false); // 没初始化
    await rt.crawlBoard({ board_node_id: 1, mode: 'recent' });
    expect(await rt.isLoggedIn()).toBe(true);
  });
});
