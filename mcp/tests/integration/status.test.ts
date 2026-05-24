import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFixture } from '../fixtures/build-fixture.js';
import { openReaders } from '../../src/runtime/sqlite-readers.js';
import { statusTool } from '../../src/tools/core/status.js';
import { CrawlerRuntime } from '../../src/runtime/crawler-runtime.js';

let dataDir: string;
let readers: ReturnType<typeof openReaders>;

const fakeFactory = async () => ({
  crawlBoard: vi.fn(),
  crawlThread: vi.fn(),
  isLoggedIn: vi.fn().mockResolvedValue(true),
  sessionExpiresAt: vi.fn().mockResolvedValue('2026-06-01T00:00:00Z'),
  shutdown: vi.fn(),
});

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'bbs-mcp-'));
  buildFixture(dataDir);
  readers = openReaders(dataDir);
});
afterAll(() => { readers.close(); rmSync(dataDir, { recursive: true, force: true }); });

describe('status tool', () => {
  it('returns global counts and graph=disabled', async () => {
    const crawler = new CrawlerRuntime({ siteKey: 'school-bbs', dataDir: '/tmp', factory: fakeFactory });
    const r = await statusTool.handler({}, { readers, crawler, graphEnabled: false });
    expect(r.global.sites).toBe(1);
    expect(r.global.boards).toBe(2);
    expect(r.global.threads_total).toBe(4);
    expect(r.graph.enabled).toBe(false);
    expect(r.session.logged_in).toBe(false); // crawler not initialized (isLoggedIn returns false)
  });

  it('returns board-specific stats when board_node_id given', async () => {
    const crawler = new CrawlerRuntime({ siteKey: 'school-bbs', dataDir: '/tmp', factory: fakeFactory });
    const guanshuiId = readers.listBoards('school-bbs').find((b) => b.name === '灌水')!.node_id;
    const r = await statusTool.handler(
      { board_node_id: guanshuiId },
      { readers, crawler, graphEnabled: false },
    );
    expect(r.board).toBeDefined();
    expect(r.board!.last_crawled_at).toBe('2026-05-24T10:00:00Z');
    expect(r.board!.pinned_count).toBe(1);
  });
});
