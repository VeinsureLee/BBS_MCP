import { describe, it, expect } from 'vitest';
import { buildForumTree } from '../../../src/resources/forum-tree';

function mockCrawler() {
  return {
    readers: {
      listSites: async () => [{ siteKey: 's', displayName: 'S', baseUrl: 'http://x' }],
      listSections: async () => [
        { id: 1, sectionKey: 'F1', name: 'F1', type: 'forum', level: 1, fullPath: null, parentId: null },
        { id: 2, sectionKey: 'F1.A', name: 'A', type: 'sub_forum', level: 2, fullPath: null, parentId: 1 },
      ],
      listBoards: async () => [
        { id: 10, boardKey: 'B1', name: '版面1', moderators: [], parentId: 1, dbPath: 'p' },
        { id: 20, boardKey: 'B2', name: '版面2', moderators: [], parentId: 2, dbPath: 'p' },
      ],
    },
  } as any;
}

describe('buildForumTree', () => {
  it('builds nested site -> forum -> sub_forum / board tree', async () => {
    const t = await buildForumTree(mockCrawler());
    expect(t.sites).toHaveLength(1);
    const site = t.sites[0]!;
    expect(site.children).toHaveLength(1);
    const f1 = site.children[0]!;
    expect(f1.kind).toBe('forum');
    expect(f1.children.find((c) => c.kind === 'board' && c.node_id === 10)).toBeTruthy();
    const sub = f1.children.find((c) => c.kind === 'sub_forum' && c.node_id === 2);
    expect(sub?.children.find((c) => c.node_id === 20)).toBeTruthy();
  });
});
