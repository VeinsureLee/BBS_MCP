import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFixture } from '../fixtures/build-fixture.js';
import { openReaders } from '../../src/runtime/sqlite-readers.js';
import { buildForumTree, forumTreeUri } from '../../src/resources/forum-tree.js';

let dataDir: string;
let readers: ReturnType<typeof openReaders>;

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'bbs-mcp-'));
  buildFixture(dataDir);
  readers = openReaders(dataDir);
});
afterAll(() => { readers.close(); rmSync(dataDir, { recursive: true, force: true }); });

describe('forum-tree resource', () => {
  it('has a stable uri', () => {
    expect(forumTreeUri).toBe('bbs://forum-tree');
  });

  it('builds a tree with site → forum → board structure', () => {
    const tree = buildForumTree(readers);
    expect(tree.sites).toHaveLength(1);
    expect(tree.sites[0].site_key).toBe('school-bbs');
    expect(tree.sites[0].children).toHaveLength(1);
    expect(tree.sites[0].children[0].name).toBe('生活');
    expect(tree.sites[0].children[0].children).toHaveLength(2);

    const guanshui = tree.sites[0].children[0].children.find((n) => n.name === '灌水')!;
    expect(guanshui.kind).toBe('board');
    expect(guanshui.node_id).toBeDefined();
    expect(guanshui.pinned_count).toBe(1);
    expect(guanshui.plain_count).toBe(2);
  });
});
