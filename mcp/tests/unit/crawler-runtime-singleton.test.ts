import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bbs-crawler', () => {
  return {
    createCrawler: vi.fn(async () => ({
      service: {} as any,
      readers: { listSites: vi.fn(async () => []) } as any,
      runInitSections: vi.fn(),
      runInitBoards: vi.fn(),
      runInitPinned: vi.fn(),
      runRefreshBoardStats: vi.fn(),
      withLoggedInPage: vi.fn(async (fn: any) => fn({} as any)),
      shutdown: vi.fn(async () => {}),
    })),
    loadAndResolvePaths: vi.fn(),
    getAdapter: vi.fn(() => ({ isLoggedIn: vi.fn(async () => true) })),
  };
});

// Imports must come AFTER vi.mock for the mock to take effect.
import { initCrawler, getCrawler, shutdownCrawler, _resetForTests } from '../../src/runtime/crawler';

beforeEach(async () => {
  _resetForTests();
  const { createCrawler } = await import('bbs-crawler');
  (createCrawler as any).mockClear();
});

describe('crawler runtime singleton', () => {
  it('initCrawler returns a Crawler and getCrawler returns the same instance', async () => {
    const c1 = await initCrawler({ siteKey: 'school-bbs' });
    const c2 = getCrawler();
    expect(c1).toBe(c2);
  });

  it('initCrawler is idempotent — second call returns the same instance without re-creating', async () => {
    const c1 = await initCrawler({ siteKey: 'school-bbs' });
    const c2 = await initCrawler({ siteKey: 'school-bbs' });
    expect(c1).toBe(c2);
    const { createCrawler } = await import('bbs-crawler');
    expect((createCrawler as any).mock.calls.length).toBe(1);
  });

  it('concurrent initCrawler calls dedupe to a single createCrawler invocation', async () => {
    const [c1, c2] = await Promise.all([
      initCrawler({ siteKey: 'school-bbs' }),
      initCrawler({ siteKey: 'school-bbs' }),
    ]);
    expect(c1).toBe(c2);
    const { createCrawler } = await import('bbs-crawler');
    expect((createCrawler as any).mock.calls.length).toBe(1);
  });

  it('getCrawler throws before initCrawler has resolved', () => {
    expect(() => getCrawler()).toThrow();
  });

  it('shutdownCrawler invokes underlying shutdown and clears state', async () => {
    const c = await initCrawler({ siteKey: 'school-bbs' });
    await shutdownCrawler();
    expect((c.shutdown as any).mock.calls.length).toBe(1);
    expect(() => getCrawler()).toThrow();
  });

  it('shutdownCrawler is safe to call when not initialized', async () => {
    await expect(shutdownCrawler()).resolves.not.toThrow();
  });
});

import { warmUpBrowser, getBrowserReady } from '../../src/runtime/crawler';

describe('warmUpBrowser', () => {
  it('initial getBrowserReady() is false', () => {
    _resetForTests();
    expect(getBrowserReady()).toBe(false);
  });

  it('sets browserReady=true on successful warm-up', async () => {
    _resetForTests();
    await initCrawler({ siteKey: 'school-bbs' });
    await warmUpBrowser('school-bbs');
    expect(getBrowserReady()).toBe(true);
  });

  it('keeps browserReady=false and rethrows when withLoggedInPage fails', async () => {
    _resetForTests();
    const c = await initCrawler({ siteKey: 'school-bbs' });
    (c.withLoggedInPage as any).mockRejectedValueOnce(new Error('login required'));
    await expect(warmUpBrowser('school-bbs')).rejects.toThrow();
    expect(getBrowserReady()).toBe(false);
  });

  it('keeps browserReady=false when adapter.isLoggedIn returns false', async () => {
    _resetForTests();
    await initCrawler({ siteKey: 'school-bbs' });
    const { getAdapter } = await import('bbs-crawler');
    (getAdapter as any).mockReturnValueOnce({ isLoggedIn: vi.fn(async () => false) });
    await expect(warmUpBrowser('school-bbs')).rejects.toThrow();
    expect(getBrowserReady()).toBe(false);
  });

  it('_resetForTests resets browserReady to false', async () => {
    _resetForTests();
    await initCrawler({ siteKey: 'school-bbs' });
    await warmUpBrowser('school-bbs');
    expect(getBrowserReady()).toBe(true);
    _resetForTests();
    expect(getBrowserReady()).toBe(false);
  });
});
