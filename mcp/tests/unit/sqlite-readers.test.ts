import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFixture } from '../fixtures/build-fixture.js';
import { openReaders, type Readers } from '../../src/runtime/sqlite-readers.js';

let dataDir: string;
let readers: Readers;

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'bbs-mcp-'));
  buildFixture(dataDir);
  readers = openReaders(dataDir);
});

afterAll(() => {
  readers.close();
  rmSync(dataDir, { recursive: true, force: true });
});

describe('sqlite readers', () => {
  it('lists sites', () => {
    const sites = readers.listSites();
    expect(sites).toHaveLength(1);
    expect(sites[0].site_key).toBe('school-bbs');
  });

  it('lists boards for a site with counts and last_crawled_at', () => {
    const boards = readers.listBoards('school-bbs');
    expect(boards).toHaveLength(2);
    const guanshui = boards.find((b) => b.name === '灌水');
    expect(guanshui).toBeDefined();
    expect(guanshui!.pinned_count).toBe(1);
    expect(guanshui!.plain_count).toBe(2);
    expect(guanshui!.last_crawled_at).toBe('2026-05-24T10:00:00Z');
    expect(guanshui!.path).toEqual(['生活', '灌水']);
  });

  it('lists threads in a board filtered by kind', () => {
    const boards = readers.listBoards('school-bbs');
    const guanshui = boards.find((b) => b.name === '灌水')!;

    const pinned = readers.threadsByBoard(guanshui.node_id, { kind: 'pinned', limit: 10 });
    expect(pinned.threads).toHaveLength(1);
    expect(pinned.threads[0].title).toBe('版规公告');

    const plain = readers.threadsByBoard(guanshui.node_id, { kind: 'plain', limit: 10 });
    expect(plain.threads).toHaveLength(2);

    const all = readers.threadsByBoard(guanshui.node_id, { kind: 'all', limit: 10 });
    expect(all.threads).toHaveLength(3);
  });

  it('filters threads by since', () => {
    const boards = readers.listBoards('school-bbs');
    const guanshui = boards.find((b) => b.name === '灌水')!;
    const since = readers.threadsByBoard(guanshui.node_id, { kind: 'all', since: '2026-05-21T00:00:00Z', limit: 10 });
    expect(since.threads.map((t) => t.title)).toEqual(['张三老师课怎么样']);
  });

  it('gets thread by url with posts', () => {
    const r = readers.getThreadByUrl('https://example.edu/t/2');
    expect(r).not.toBeNull();
    expect(r!.thread.title).toBe('食堂第三餐厅怎么样');
    expect(r!.posts).toHaveLength(2);
    expect(r!.posts[0].floor).toBe(1);
  });

  it('returns null for missing thread', () => {
    expect(readers.getThreadByUrl('https://example.edu/missing')).toBeNull();
  });
});
