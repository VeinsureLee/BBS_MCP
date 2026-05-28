import { describe, it, expect } from 'vitest';
import { pingTool } from '../../../src/tools/meta/ping';
import { statusTool } from '../../../src/tools/meta/status';

function mockCrawler() {
  return {
    readers: {
      listSites: async () => [{ siteKey: 's', displayName: 'S', baseUrl: 'http://x' }],
      listSections: async () => [{ id: 1 }, { id: 2 }],
      listBoards: async () => [{ id: 1, dbPath: 'p' }, { id: 2, dbPath: 'p' }],
      listThreadsByBoard: async (_id: number, opts: { kind?: 'all'|'pinned'|'plain' }) => {
        if (opts.kind === 'pinned') return [{ id: 1 } as any];
        if (opts.kind === 'plain') return [{ id: 2 }, { id: 3 }] as any;
        return [{ id: 1 }, { id: 2 }, { id: 3 }] as any;
      },
    },
    withLoggedInPage: async <T,>(_fn: (p: any) => Promise<T>) => true as unknown as T,
  } as any;
}

describe('pingTool', () => {
  it('returns ok with version and uptime', async () => {
    const out = await pingTool.handler({}, { version: '1.2.3', startedAt: Date.now() - 1500 });
    expect(out.ok).toBe(true);
    expect(out.version).toBe('1.2.3');
    expect(out.uptime_seconds).toBeGreaterThanOrEqual(1);
  });

  it('zero uptime is allowed', async () => {
    const out = await pingTool.handler({}, { version: '0', startedAt: Date.now() });
    expect(out.uptime_seconds).toBeGreaterThanOrEqual(0);
  });
});

describe('statusTool', () => {
  it('returns counts, login state, graph flag, version, uptime', async () => {
    const out = await statusTool.handler({}, {
      crawler: mockCrawler(),
      graphEnabled: false,
      version: '1.0.0',
      startedAt: Date.now() - 500,
      siteKey: 's',
    });
    expect(out.counts.sites).toBe(1);
    expect(out.counts.sections).toBe(2);
    expect(out.counts.boards).toBe(2);
    expect(out.counts.threads_pinned).toBe(2);  // 2 boards × 1 pinned each
    expect(out.counts.threads_plain).toBe(4);   // 2 boards × 2 plain each
    expect(out.counts.threads_total).toBe(6);
    expect(out.graph_enabled).toBe(false);
    expect(out.version).toBe('1.0.0');
    expect(out.logged_in).toBe(true);
    expect(out.session_expires_at).toBeNull();
    expect(out.last_crawled_at).toBeNull();
  });

  it('logged_in falls back to false when withLoggedInPage throws', async () => {
    const c = mockCrawler();
    c.withLoggedInPage = async () => { throw new Error('no session'); };
    const out = await statusTool.handler({}, {
      crawler: c,
      graphEnabled: true,
      version: '1.0.0',
      startedAt: Date.now(),
      siteKey: 's',
    });
    expect(out.logged_in).toBe(false);
    expect(out.graph_enabled).toBe(true);
  });
});
