import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFixture } from '../fixtures/build-fixture.js';
import { openReaders } from '../../src/runtime/sqlite-readers.js';
import { getThreadTool } from '../../src/tools/core/get-thread.js';

let dataDir: string;
let readers: ReturnType<typeof openReaders>;

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'bbs-mcp-'));
  buildFixture(dataDir);
  readers = openReaders(dataDir);
});
afterAll(() => { readers.close(); rmSync(dataDir, { recursive: true, force: true }); });

describe('get_thread tool', () => {
  it('fetches by url', async () => {
    const result = await getThreadTool.handler(
      { url: 'https://example.edu/t/2' },
      { readers, graphEnabled: false },
    );
    expect(result.thread.title).toBe('食堂第三餐厅怎么样');
    expect(result.posts).toHaveLength(2);
  });

  it('fetches by (forum_db, thread_id)', async () => {
    const result = await getThreadTool.handler(
      { forum_db: 'forums/forum-life/guanshui.db', thread_id: 2 },
      { readers, graphEnabled: false },
    );
    expect(result.thread.title).toBe('食堂第三餐厅怎么样');
  });

  it('rejects when neither url nor id given', async () => {
    await expect(
      getThreadTool.handler({} as any, { readers, graphEnabled: false }),
    ).rejects.toThrow();
  });

  it('throws when thread missing', async () => {
    await expect(
      getThreadTool.handler(
        { url: 'https://example.edu/missing' },
        { readers, graphEnabled: false },
      ),
    ).rejects.toThrow(/not found/i);
  });
});
