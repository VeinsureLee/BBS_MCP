import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFixture } from '../fixtures/build-fixture.js';
import { openReaders } from '../../src/runtime/sqlite-readers.js';
import { listSitesTool } from '../../src/tools/core/list-sites.js';
import { listBoardsTool } from '../../src/tools/core/list-boards.js';

let dataDir: string;
let readers: ReturnType<typeof openReaders>;

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'bbs-mcp-'));
  buildFixture(dataDir);
  readers = openReaders(dataDir);
});
afterAll(() => { readers.close(); rmSync(dataDir, { recursive: true, force: true }); });

describe('list-sites tool', () => {
  it('returns the registered sites', async () => {
    const result = await listSitesTool.handler({}, { readers });
    expect(result.sites).toHaveLength(1);
    expect(result.sites[0].site_key).toBe('school-bbs');
    expect(result.sites[0].base_url).toBe('https://example.edu/bbs');
  });
});

describe('list-boards tool', () => {
  it('returns boards with counts and path', async () => {
    const result = await listBoardsTool.handler({ site_key: 'school-bbs' }, { readers, graphEnabled: false });
    expect(result.boards.length).toBe(2);
    const guanshui = result.boards.find((b) => b.name === '灌水')!;
    expect(guanshui.pinned_count).toBe(1);
    expect(guanshui.plain_count).toBe(2);
    expect(guanshui.path).toEqual(['生活', '灌水']);
    expect(result.freshness.as_of).toBeDefined();
  });

  it('omits site_key filter when not provided', async () => {
    const result = await listBoardsTool.handler({}, { readers, graphEnabled: false });
    expect(result.boards.length).toBe(2);
  });
});
