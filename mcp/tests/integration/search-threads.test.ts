import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFixture } from '../fixtures/build-fixture.js';
import { openReaders } from '../../src/runtime/sqlite-readers.js';
import { searchThreadsTool } from '../../src/tools/core/search-threads.js';

let dataDir: string;
let readers: ReturnType<typeof openReaders>;
let guanshuiId: number;

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'bbs-mcp-'));
  buildFixture(dataDir);
  readers = openReaders(dataDir);
  guanshuiId = readers.listBoards('school-bbs').find((b) => b.name === '灌水')!.node_id;
});
afterAll(() => { readers.close(); rmSync(dataDir, { recursive: true, force: true }); });

describe('search_threads tool', () => {
  it('finds threads by title globally', async () => {
    const r = await searchThreadsTool.handler(
      { query: '老师', limit: 20 },
      { readers, graphEnabled: false },
    );
    expect(r.threads.map((t) => t.title)).toContain('张三老师课怎么样');
  });

  it('scopes to one board when board_node_id given', async () => {
    const r = await searchThreadsTool.handler(
      { query: '推荐', board_node_id: guanshuiId, limit: 20 },
      { readers, graphEnabled: false },
    );
    expect(r.threads).toHaveLength(0); // "推荐" only in jishu
  });

  it('escapes LIKE wildcards in query', async () => {
    const r = await searchThreadsTool.handler(
      { query: '%', limit: 20 },
      { readers, graphEnabled: false },
    );
    expect(r.threads).toHaveLength(0);
  });

  it('rejects empty query', async () => {
    await expect(
      searchThreadsTool.handler({ query: '', limit: 20 }, { readers, graphEnabled: false }),
    ).rejects.toThrow();
  });
});
