import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFixture } from '../fixtures/build-fixture.js';
import { openReaders } from '../../src/runtime/sqlite-readers.js';
import { threadsByBoardTool } from '../../src/tools/core/threads-by-board.js';

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

describe('threads_by_board tool', () => {
  it('returns pinned-only when kind=pinned', async () => {
    const result = await threadsByBoardTool.handler(
      { board_node_id: guanshuiId, kind: 'pinned', limit: 20 },
      { readers, graphEnabled: false },
    );
    expect(result.threads).toHaveLength(1);
    expect(result.threads[0]?.is_pinned).toBe(true);
    expect(result.freshness.board_last_crawled_at).toBe('2026-05-24T10:00:00Z');
  });

  it('returns all by default', async () => {
    const result = await threadsByBoardTool.handler(
      { board_node_id: guanshuiId, kind: 'all', limit: 20 },
      { readers, graphEnabled: false },
    );
    expect(result.threads).toHaveLength(3);
  });

  it('respects since filter', async () => {
    const result = await threadsByBoardTool.handler(
      { board_node_id: guanshuiId, kind: 'all', since: '2026-05-21T00:00:00Z', limit: 20 },
      { readers, graphEnabled: false },
    );
    expect(result.threads.map((t) => t.title)).toEqual(['张三老师课怎么样']);
  });

  it('throws BoardNotFound mapping when board_node_id missing', async () => {
    await expect(
      threadsByBoardTool.handler(
        { board_node_id: 99999, kind: 'all', limit: 20 },
        { readers, graphEnabled: false },
      ),
    ).rejects.toThrow(/not found/i);
  });
});
